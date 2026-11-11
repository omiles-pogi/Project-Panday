<?php

namespace App\Services;

use App\Models\Project;
use App\Models\ProjectActivityLog;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;

class ProjectDashboardService
{
    /** A read-only landing feed, independent of the project selected in the planner or other tabs. */
    public function overview(User $owner): array
    {
        abort_unless($owner->role === 'homeowner', 403);
        $projects = $owner->projects()->visibleOnHomeDashboard()
            ->with(['phases', 'workers:id,name', 'contractors:id,name'])
            ->latest('started_at')->latest('id')->get();
        $events = [];
        $append = function (Project $project, string $key, string $type, string $title, string $description, mixed $when) use (&$events): void {
            // Missing event timestamps remain unknown; never substitute today's date.
            if ($when === null) {
                return;
            }
            $recorded = Carbon::parse($when);
            $events[] = [
                'id' => $key, 'type' => $type, 'title' => $title, 'description' => $description,
                'projectId' => $project->id, 'projectStatus' => $project->status,
                'createdAt' => $recorded->toIso8601String(), '_timestamp' => $recorded->getTimestamp(),
            ];
        };
        foreach ($projects as $project) {
            $append($project, "created-{$project->id}", 'project_created', 'Project Created', "{$project->title} was created.", $project->created_at);
            if ($project->status === 'completed') {
                $append($project, "completed-{$project->id}", 'project_completed', 'Project Completed', "Completion of {$project->title} was confirmed.", $project->completion_confirmed_at);
            }
            $append($project, "submitted-{$project->id}", 'project_submitted', 'Completion Submitted', "{$project->title} was submitted for completion review.", $project->finished_at);
            foreach ($project->contractors as $member) {
                $append($project, "contractor-{$project->id}-{$member->id}", 'contractor_assigned', 'Contractor Assigned', "{$member->name} joined {$project->title} as a contractor.", $member->pivot->created_at);
            }
            foreach ($project->workers as $member) {
                $append($project, "worker-{$project->id}-{$member->id}", 'worker_joined', 'Worker Joined', "{$member->name} joined {$project->title}.", $member->pivot->created_at);
            }
        }
        $byId = $projects->keyBy('id');
        $logs = ProjectActivityLog::whereIn('project_id', $projects->modelKeys())
            ->latest('created_at')->latest('id')->limit(8)->get();
        foreach ($logs as $log) {
            $project = $byId[$log->project_id];
            $append($project, "task-{$log->id}", $log->is_done ? 'task_completed' : 'task_reopened',
                $log->is_done ? 'Task Completed' : 'Task Reopened', "{$log->task_description} — {$project->title}", $log->created_at);
        }
        $summaries = $projects->map(function (Project $project) {
            $plan = $project->approved_plan ?? [];

            return [
                'id' => $project->id, 'title' => trim($project->title ?? '') ?: "Project #{$project->id}",
                'status' => $project->status, 'location' => $project->location,
                'startedAt' => $project->started_at?->toDateString(),
                'floors' => isset($plan['floors']) && is_numeric($plan['floors']) && $plan['floors'] > 0 ? (int) $plan['floors'] : null,
                'overallProgressPct' => $project->overallProgressPct(),
            ];
        });

        return [
            // The full visible picker data lets New Project resume an existing planning draft.
            'projects' => $summaries->values(),
            'ongoingProjects' => $summaries->where('status', 'active')->values(),
            'recentActivity' => collect($events)->sortBy([['_timestamp', 'desc'], ['id', 'desc']])->take(8)
                ->map(function (array $event) {
                    unset($event['_timestamp']);

                    return $event;
                })->values(),
        ];
    }

    public function hide(Project $project, User $owner): array
    {
        abort_unless($owner->role === 'homeowner', 403);

        return DB::transaction(function () use ($project, $owner) {
            $locked = $owner->projects()->whereKey($project->id)->lockForUpdate()->firstOrFail();
            if ($locked->status !== 'completed') {
                throw ValidationException::withMessages(['project_id' => 'Only completed projects can be removed from the dashboard.']);
            }
            // Keep Home readable before deployment of the additive migration, but never
            // report a successful removal until the durable visibility flag can be saved.
            abort_unless(Schema::hasColumn('projects', 'is_hidden_from_dashboard'), 503, 'Dashboard removal is temporarily unavailable. Please try again later.');
            if (! $locked->is_hidden_from_dashboard) {
                $locked->is_hidden_from_dashboard = true;
                $locked->save();
            }

            return ['id' => $locked->id, 'status' => $locked->status, 'isHiddenFromDashboard' => true];
        });
    }
}
