<?php

namespace App\Services;

use App\Models\Project;
use App\Models\ProjectPhase;
use App\Models\ProjectPhaseTask;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Finishing a project. The contractor checks off the work — one task at a time through
 * ProjectService, or a whole phase at once here — and, when every task is done, submits the project as
 * finished. That moves it to "pending_confirmation" and locks the checklist; the homeowner then
 * either confirms ("completed") or asks for corrections (back to "active", checklist open again).
 *
 * Nothing finishes by itself: reaching 100% only makes the contractor's "Mark Project as Finished"
 * available. Every rule is enforced here, on the server, inside a transaction that re-reads the
 * project under a lock, so a direct API call can't skip a step and two requests can't both win.
 */
class ProjectCompletionService
{
    public function __construct(
        private readonly ProjectService $projects,
        private readonly NotificationService $notifications,
    ) {}

    // ---- one phase's checklist, all at once ----------------------------------------------------

    /**
     * Checks every task in one phase (Site Preparation, Foundation…).
     *
     * @return array<string, mixed>
     *
     * @throws ValidationException
     */
    public function checkAll(Project $project, ProjectPhase $phase, User $acting): array
    {
        return $this->setAllTasks($project, $phase, $acting, true);
    }

    /**
     * @return array<string, mixed>
     *
     * @throws ValidationException
     */
    public function uncheckAll(Project $project, ProjectPhase $phase, User $acting): array
    {
        return $this->setAllTasks($project, $phase, $acting, false);
    }

    /**
     * Goes through the same per-task update as ticking a box by hand, so each change gets its
     * completion time, phase progress and activity-log entry exactly as it would one by one.
     *
     * @return array<string, mixed>
     */
    private function setAllTasks(Project $project, ProjectPhase $phase, User $acting, bool $done): array
    {
        $this->projects->assertCanManageChecklist($project, $acting);

        DB::transaction(function () use ($project, $phase, $acting, $done) {
            $locked = Project::whereKey($project->id)->lockForUpdate()->firstOrFail();
            // The status may have moved on since the check above.
            $this->projects->assertCanManageChecklist($locked, $acting);

            ProjectPhaseTask::query()
                ->where('project_phase_id', $phase->id)
                ->where('is_done', ! $done)
                ->with('phase')
                ->orderBy('id')
                ->get()
                ->each(fn (ProjectPhaseTask $task) => $this->projects->updatePhaseTask($task, $acting, $done));
        });

        return $this->state($project);
    }

    // ---- the contractor finishes ---------------------------------------------------------------

    /**
     * @return array<string, mixed>
     *
     * @throws ValidationException
     */
    public function submit(Project $project, User $acting): array
    {
        if (! $project->hasAssignedContractor($acting)) {
            throw ValidationException::withMessages(['project_id' => 'Only a contractor assigned to this project can mark it as finished.']);
        }

        DB::transaction(function () use ($project, $acting) {
            $locked = Project::whereKey($project->id)->lockForUpdate()->firstOrFail();

            if ($locked->status !== 'active') {
                throw ValidationException::withMessages(['project_id' => match ($locked->status) {
                    Project::PENDING_CONFIRMATION => 'This project has already been submitted and is waiting for the homeowner.',
                    'completed' => 'This project is already completed.',
                    default => 'Only an ongoing project can be marked as finished.',
                }]);
            }

            $locked->load('phases.tasks');
            $summary = $locked->checklistSummary();
            if ($summary['totalTasks'] === 0) {
                throw ValidationException::withMessages(['project_id' => 'Add checklist tasks and complete them before marking the project as finished.']);
            }
            if ($summary['doneTasks'] < $summary['totalTasks']) {
                throw ValidationException::withMessages(['project_id' => "Complete every checklist task before marking the project as finished ({$summary['doneTasks']} of {$summary['totalTasks']} done)."]);
            }

            $locked->update([
                'status' => Project::PENDING_CONFIRMATION,
                'finished_at' => now(),
                'finished_by' => $acting->id,
                // A fresh submission starts the homeowner's review over.
                'completion_confirmed_at' => null,
                'corrections_requested_at' => null,
                'corrections_note' => null,
            ]);
        });

        $project->refresh();
        $project->loadMissing('user');
        $this->notifications->send(
            $project->user,
            'project_completion_submitted',
            'Project submitted as finished',
            "{$acting->name} marked \"{$project->title}\" as finished. Please review it and confirm completion, or request corrections.",
            ['projectId' => $project->id, 'projectTitle' => $project->title]
        );

        return $this->state($project);
    }

    // ---- the homeowner decides -----------------------------------------------------------------

    /**
     * @return array<string, mixed>
     *
     * @throws ValidationException
     */
    public function confirm(Project $project, User $acting): array
    {
        $this->assertOwner($project, $acting);

        DB::transaction(function () use ($project) {
            $locked = $this->lockPending($project);

            $locked->update(['status' => 'completed', 'completion_confirmed_at' => now()]);
        });

        $project->refresh();
        $this->notifyContractors(
            $project,
            'project_completion_confirmed',
            'Project completed',
            "The homeowner confirmed that \"{$project->title}\" is complete."
        );

        return $this->state($project);
    }

    /**
     * @return array<string, mixed>
     *
     * @throws ValidationException
     */
    public function requestCorrections(Project $project, User $acting, string $note): array
    {
        $this->assertOwner($project, $acting);
        $note = trim($note);

        DB::transaction(function () use ($project, $note) {
            $locked = $this->lockPending($project);

            $locked->update([
                'status' => 'active',
                'corrections_requested_at' => now(),
                'corrections_note' => $note,
                // It's not finished any more, so there's no submission to point at.
                'finished_at' => null,
                'finished_by' => null,
            ]);
        });

        $project->refresh();
        $this->notifyContractors(
            $project,
            'project_corrections_requested',
            'Corrections requested',
            "The homeowner asked for corrections on \"{$project->title}\": {$note}"
        );

        return $this->state($project);
    }

    /**
     * @throws ValidationException
     */
    private function assertOwner(Project $project, User $acting): void
    {
        if (! $project->isOwnedBy($acting)) {
            throw ValidationException::withMessages(['project_id' => 'Only the homeowner of this project can respond to its completion.']);
        }
    }

    /**
     * Re-reads the project under a lock and insists it's still waiting for the homeowner.
     *
     * @throws ValidationException
     */
    private function lockPending(Project $project): Project
    {
        $locked = Project::whereKey($project->id)->lockForUpdate()->firstOrFail();

        if ($locked->status !== Project::PENDING_CONFIRMATION) {
            throw ValidationException::withMessages(['project_id' => 'This project is not waiting for your confirmation.']);
        }

        return $locked;
    }

    private function notifyContractors(Project $project, string $type, string $title, string $body): void
    {
        $project->load('contractors');

        foreach ($project->contractors as $contractor) {
            $this->notifications->send($contractor, $type, $title, $body, ['projectId' => $project->id, 'projectTitle' => $project->title]);
        }
    }

    /**
     * Where the project stands now, for the screen that just acted on it.
     *
     * @return array<string, mixed>
     */
    private function state(Project $project): array
    {
        $project = Project::with('phases.tasks')->findOrFail($project->id);

        return [
            'id' => $project->id,
            'status' => $project->status,
            'overallProgressPct' => $project->overallProgressPct(),
            'checklist' => $project->checklistSummary(),
            'completion' => $project->completionSummary(),
        ];
    }
}
