<?php

namespace App\Services;

use App\Models\Project;
use App\Models\ProjectPhase;
use App\Models\ProjectPhaseTask;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

/**
 * Calendar-based project monitoring: lays the AI plan's phases out on a calendar (the proposed
 * schedule) and compares it with what has actually been checked off.
 *
 * The schedule is stored per phase (planned_start/planned_end) so it stays stable once proposed;
 * each phase's tasks are then spread evenly across that phase's window, in checklist order, rather
 * than stored individually.
 */
class TimelineService
{
    /** Variance (actual − planned, in percentage points) beyond which a project counts as ahead / behind. */
    private const ON_TRACK_MARGIN = 5;

    private const SIGNIFICANTLY_BEHIND_MARGIN = 15;

    /** A runaway overrun must not generate an unbounded month list. */
    private const MAX_MONTHS = 60;

    /**
     * Proposes the schedule if any phase doesn't have one yet (projects created before this
     * feature, or a phase without dates). A no-op once every phase is scheduled.
     */
    public function ensureSchedule(Project $project): void
    {
        $project->loadMissing('phases');

        if ($project->phases->isEmpty() || $project->phases->every(fn (ProjectPhase $p) => $p->planned_start && $p->planned_end)) {
            return;
        }

        $this->schedule($project);
    }

    /**
     * Splits the project's [started_at, started_at + timeline_months) window across its phases, in
     * order, proportionally to the AI's per-phase duration — or, when any phase lacks one (older
     * plans, hand-added phases), proportionally to each phase's share of the project.
     */
    public function schedule(Project $project): void
    {
        $project->loadMissing('phases');
        $phases = $project->phases->values();
        if ($phases->isEmpty()) {
            return;
        }

        $start = $project->started_at->copy()->startOfDay();
        $end = $start->copy()->addMonthsNoOverflow(max(1, (int) $project->timeline_months))->subDay();
        $totalDays = (int) $start->diffInDays($end) + 1;

        $useDurations = $phases->every(fn (ProjectPhase $p) => $p->duration_weeks > 0);
        $weights = $phases->map(fn (ProjectPhase $p) => $useDurations ? $p->duration_weeks : $p->weight_pct)->all();
        if (array_sum($weights) <= 0) {
            $weights = array_fill(0, $phases->count(), 1);
        }
        $weightTotal = array_sum($weights);

        $cumulative = 0;
        $previousBoundary = 0;
        $lastIndex = $phases->count() - 1;

        foreach ($phases as $index => $phase) {
            $cumulative += $weights[$index];
            // The last phase always lands exactly on the project's end; every phase gets at least a day.
            $boundary = $index === $lastIndex ? $totalDays : (int) round($totalDays * $cumulative / $weightTotal);
            $boundary = max($boundary, $previousBoundary + 1);

            $phase->update([
                'planned_start' => $start->copy()->addDays($previousBoundary)->toDateString(),
                'planned_end' => $start->copy()->addDays($boundary - 1)->toDateString(),
            ]);

            $previousBoundary = $boundary;
        }
    }

    /**
     * @return array<string, mixed>
     *
     * @throws ValidationException
     */
    public function timelineFor(Project $project, User $actingUser): array
    {
        if (! $project->canViewTimeline($actingUser)) {
            throw ValidationException::withMessages(['project_id' => 'You cannot view this project\'s calendar.']);
        }

        $project->load('phases.tasks');
        $this->ensureSchedule($project);

        $today = Carbon::today();
        $phases = $project->phases->values();

        if ($phases->isEmpty()) {
            return $this->emptyTimeline($project, $today);
        }

        $projectStart = $phases->first()->planned_start->copy();
        $projectEnd = $phases->last()->planned_end->copy();

        $phaseItems = $phases->map(fn (ProjectPhase $phase) => $this->presentPhase($phase, $today));
        $tasks = $phases->flatMap(fn (ProjectPhase $phase) => $this->presentTasks($phase, $today))->values();

        return [
            'projectId' => $project->id,
            'title' => $project->title,
            'startDate' => $projectStart->toDateString(),
            'endDate' => $projectEnd->toDateString(),
            'timelineMonths' => $project->timeline_months,
            'today' => $today->toDateString(),
            'overall' => $this->presentOverall($project, $phases, $tasks, $projectStart, $projectEnd, $today),
            'phases' => $phaseItems->values(),
            'months' => $this->months($phases, $tasks, $projectStart, $projectEnd, $today),
        ];
    }

    /**
     * Just the headline figures (planned vs actual, status, overdue tasks) with no viewer attached,
     * for the delay alerts, which run from the scheduler as well as from a request.
     *
     * @return array<string, mixed>
     */
    public function overallFor(Project $project): array
    {
        $project->load('phases.tasks');
        $this->ensureSchedule($project);

        $today = Carbon::today();
        $phases = $project->phases->values();

        if ($phases->isEmpty()) {
            return $this->emptyTimeline($project, $today)['overall'];
        }

        $tasks = $phases->flatMap(fn (ProjectPhase $phase) => $this->presentTasks($phase, $today))->values();

        return $this->presentOverall($project, $phases, $tasks, $phases->first()->planned_start->copy(), $phases->last()->planned_end->copy(), $today);
    }

    /**
     * @param  Collection<int, ProjectPhase>  $phases
     * @param  Collection<int, array<string, mixed>>  $tasks
     * @return array<string, mixed>
     */
    private function presentOverall(Project $project, Collection $phases, Collection $tasks, Carbon $projectStart, Carbon $projectEnd, Carbon $today): array
    {
        $planned = $this->plannedPct($phases, $today);
        $actual = $project->overallProgressPct();
        $variance = $actual - $planned;

        return [
            'plannedPct' => $planned,
            'actualPct' => $actual,
            'variancePct' => $variance,
            'status' => $this->scheduleStatus($actual, $variance, $today, $projectStart),
            'daysRemaining' => (int) $today->diffInDays($projectEnd),
            'tasks' => [
                'total' => $tasks->count(),
                'done' => $tasks->where('isDone', true)->count(),
                'overdue' => $tasks->where('status', 'overdue')->count(),
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function emptyTimeline(Project $project, Carbon $today): array
    {
        return [
            'projectId' => $project->id,
            'title' => $project->title,
            'startDate' => $project->started_at->toDateString(),
            'endDate' => $project->started_at->toDateString(),
            'timelineMonths' => $project->timeline_months,
            'today' => $today->toDateString(),
            'overall' => [
                'plannedPct' => 0,
                'actualPct' => 0,
                'variancePct' => 0,
                'status' => 'not_started',
                'daysRemaining' => 0,
                'tasks' => ['total' => 0, 'done' => 0, 'overdue' => 0],
            ],
            'phases' => [],
            'months' => [],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function presentPhase(ProjectPhase $phase, Carbon $today): array
    {
        $tasks = $phase->tasks;
        $spanDays = $this->spanDays($phase);

        if ($tasks->isNotEmpty() && $phase->progress_pct >= 100) {
            $status = 'completed';
        } elseif ($today->gt($phase->planned_end)) {
            $status = 'overdue';
        } elseif ($today->gte($phase->planned_start)) {
            $status = 'in_progress';
        } else {
            $status = 'upcoming';
        }

        return [
            'id' => $phase->id,
            'name' => $phase->name,
            'startDate' => $phase->planned_start->toDateString(),
            'endDate' => $phase->planned_end->toDateString(),
            'durationWeeks' => max(1, (int) ceil($spanDays / 7)),
            'weightPct' => $phase->weight_pct,
            'progressPct' => $phase->progress_pct,
            'plannedPct' => (int) round($this->phaseFraction($phase, $today) * 100),
            'status' => $status,
            'taskCount' => $tasks->count(),
            'tasksDone' => $tasks->where('is_done', true)->count(),
        ];
    }

    /**
     * Spreads the phase's checklist evenly across its window, in the order the tasks were added.
     *
     * @return Collection<int, array<string, mixed>>
     */
    private function presentTasks(ProjectPhase $phase, Carbon $today): Collection
    {
        $tasks = $phase->tasks->sortBy('id')->values();
        $count = $tasks->count();
        $spanDays = $this->spanDays($phase);

        return $tasks->map(function (ProjectPhaseTask $task, int $index) use ($phase, $today, $count, $spanDays) {
            $startOffset = min((int) round($spanDays * $index / $count), $spanDays - 1);
            $endOffset = min(max((int) round($spanDays * ($index + 1) / $count) - 1, $startOffset), $spanDays - 1);

            $plannedStart = $phase->planned_start->copy()->addDays($startOffset);
            $plannedEnd = $phase->planned_start->copy()->addDays($endOffset);
            $completedAt = $task->is_done ? ($task->completed_at ?? $task->updated_at) : null;

            if ($task->is_done) {
                $status = $completedAt->toDateString() > $plannedEnd->toDateString() ? 'completed_late' : 'completed';
            } elseif ($today->gt($plannedEnd)) {
                $status = 'overdue';
            } elseif ($today->gte($plannedStart)) {
                $status = 'in_progress';
            } else {
                $status = 'upcoming';
            }

            return [
                'id' => $task->id,
                'description' => $task->description,
                'phaseId' => $phase->id,
                'phaseName' => $phase->name,
                'plannedStart' => $plannedStart->toDateString(),
                'plannedEnd' => $plannedEnd->toDateString(),
                'isDone' => $task->is_done,
                'completedAt' => $completedAt?->toDateString(),
                'status' => $status,
            ];
        });
    }

    /**
     * One entry per calendar month the project touches (plus any months it has overrun into), each
     * with that month's phases, the tasks due in it, and cumulative planned vs actual progress at
     * the month's end.
     *
     * @param  Collection<int, ProjectPhase>  $phases
     * @param  Collection<int, array<string, mixed>>  $tasks
     * @return array<int, array<string, mixed>>
     */
    private function months(Collection $phases, Collection $tasks, Carbon $projectStart, Carbon $projectEnd, Carbon $today): array
    {
        $cursor = $projectStart->copy()->startOfMonth();
        $last = $projectEnd->gt($today) ? $projectEnd->copy()->startOfMonth() : $today->copy()->startOfMonth();
        $months = [];

        while ($cursor->lte($last) && count($months) < self::MAX_MONTHS) {
            $monthStart = $cursor->copy();
            $monthEnd = $cursor->copy()->endOfMonth()->startOfDay();

            $months[] = [
                'key' => $monthStart->format('Y-m'),
                'label' => $monthStart->format('F Y'),
                'year' => (int) $monthStart->format('Y'),
                'month' => (int) $monthStart->format('n'),
                'isCurrent' => $today->between($monthStart, $monthEnd),
                'plannedPct' => $this->plannedPct($phases, $monthEnd),
                // Nothing has "actually" happened in a month that hasn't started.
                'actualPct' => $monthStart->gt($today) ? null : $this->actualPctAsOf($phases, $monthEnd->lt($today) ? $monthEnd : $today, $today),
                'phases' => $phases
                    ->filter(fn (ProjectPhase $p) => $p->planned_start->lte($monthEnd) && $p->planned_end->gte($monthStart))
                    ->map(fn (ProjectPhase $p) => ['id' => $p->id, 'name' => $p->name])
                    ->values()
                    ->all(),
                'tasks' => $tasks
                    ->filter(fn (array $t) => $t['plannedEnd'] >= $monthStart->toDateString() && $t['plannedEnd'] <= $monthEnd->toDateString())
                    ->sortBy('plannedEnd')
                    ->values()
                    ->all(),
            ];

            $cursor->addMonthNoOverflow();
        }

        return $months;
    }

    /**
     * Where the schedule says the project should be on $date: each phase counts for its share of the
     * project, filling linearly across its own planned window.
     *
     * @param  Collection<int, ProjectPhase>  $phases
     */
    private function plannedPct(Collection $phases, Carbon $date): int
    {
        $total = $phases->sum('weight_pct');
        // Phases with no stated share count equally rather than dividing by zero.
        $weightOf = fn (ProjectPhase $p) => $total > 0 ? $p->weight_pct : 1;
        $denominator = $total > 0 ? $total : $phases->count();

        $weighted = $phases->sum(fn (ProjectPhase $p) => $weightOf($p) * $this->phaseFraction($p, $date));

        return (int) round(100 * $weighted / $denominator);
    }

    /**
     * Overall progress replayed as of $date from when tasks were actually completed. For today (or
     * later) it's the live figure the rest of the app shows, so the two never disagree.
     *
     * @param  Collection<int, ProjectPhase>  $phases
     */
    private function actualPctAsOf(Collection $phases, Carbon $date, Carbon $today): int
    {
        $total = $phases->sum('weight_pct');
        $denominator = $total > 0 ? $total : $phases->count();
        if ($denominator === 0) {
            return 0;
        }
        $weightOf = fn (ProjectPhase $phase) => $total > 0 ? $phase->weight_pct : 1;

        $weighted = $phases->sum(function (ProjectPhase $phase) use ($date, $today, $weightOf) {
            if ($date->gte($today)) {
                return $weightOf($phase) * $phase->progress_pct;
            }

            $count = $phase->tasks->count();
            if ($count === 0) {
                return 0;
            }

            $cutoff = $date->copy()->endOfDay();
            $done = $phase->tasks->filter(
                fn (ProjectPhaseTask $t) => $t->is_done && ($t->completed_at ?? $t->updated_at)->lte($cutoff)
            )->count();

            return $weightOf($phase) * round($done / $count * 100);
        });

        return (int) round($weighted / $denominator);
    }

    /** Fraction (0–1) of the phase's planned window that has elapsed by the end of $date. */
    private function phaseFraction(ProjectPhase $phase, Carbon $date): float
    {
        if ($date->lt($phase->planned_start)) {
            return 0.0;
        }
        if ($date->gte($phase->planned_end)) {
            return 1.0;
        }

        return ((int) $phase->planned_start->diffInDays($date) + 1) / $this->spanDays($phase);
    }

    private function spanDays(ProjectPhase $phase): int
    {
        return (int) $phase->planned_start->diffInDays($phase->planned_end) + 1;
    }

    private function scheduleStatus(int $actual, int $variance, Carbon $today, Carbon $projectStart): string
    {
        return match (true) {
            $actual >= 100 => 'completed',
            $today->lt($projectStart) => 'not_started',
            $variance > self::ON_TRACK_MARGIN => 'ahead',
            $variance >= -self::ON_TRACK_MARGIN => 'on_track',
            $variance >= -self::SIGNIFICANTLY_BEHIND_MARGIN => 'slightly_behind',
            default => 'significantly_behind',
        };
    }
}
