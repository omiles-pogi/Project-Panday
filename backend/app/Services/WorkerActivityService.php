<?php

namespace App\Services;

use App\Models\Project;
use App\Models\User;
use App\Models\WorkerAttendance;
use App\Models\WorkerWorkLog;
use App\Support\Wage;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

/**
 * What a worker does on site, day to day: attendance (check in / check out), the daily work log,
 * and the earnings those days add up to. The homeowner and the project's contractors see the same
 * figures for the team.
 *
 * "Today" is the Philippine calendar day, not the server's UTC one — otherwise a 6 am check-in
 * would land on yesterday.
 *
 * Earnings are never stored: a day-rate worker earns their rate for every day they checked in. A
 * fixed-fee worker has no per-day earnings — their fee is agreed up front — so it's left null.
 */
class WorkerActivityService
{
    private const TIMEZONE = 'Asia/Manila';

    /** How far back a daily log may be written or corrected. */
    private const LOG_BACKDATE_DAYS = 7;

    private const HISTORY_DAYS = 30;

    private const TEAM_LOG_DAYS = 14;

    private function today(): string
    {
        return Carbon::now(self::TIMEZONE)->toDateString();
    }

    private function daysAgo(int $days): string
    {
        return Carbon::now(self::TIMEZONE)->subDays($days)->toDateString();
    }

    /** @return Collection<int, Project> */
    private function activeProjectsOf(User $worker): Collection
    {
        return Project::query()
            ->where('status', 'active')
            ->whereHas('workers', fn ($q) => $q->whereKey($worker->id))
            ->orderBy('title')
            ->get();
    }

    /**
     * @throws ValidationException
     */
    private function assertWorking(Project $project, User $worker): void
    {
        if (! $project->hasAssignedWorker($worker)) {
            throw ValidationException::withMessages(['project_id' => 'You are not assigned to this project.']);
        }

        if ($project->status !== 'active') {
            throw ValidationException::withMessages(['project_id' => 'This project is not active.']);
        }
    }

    private function dayStatus(?WorkerAttendance $attendance): string
    {
        return match (true) {
            $attendance === null => 'not_in',
            $attendance->check_out_at === null => 'on_site',
            default => 'done',
        };
    }

    // ---- attendance ----------------------------------------------------------------------------

    /**
     * Today's state on each of the worker's active projects, and their last month of days.
     *
     * @return array<string, mixed>
     */
    public function attendanceFor(User $worker): array
    {
        $todays = WorkerAttendance::where('worker_id', $worker->id)->where('work_date', $this->today())->get()->keyBy('project_id');

        $today = $this->activeProjectsOf($worker)->map(function (Project $project) use ($todays) {
            $attendance = $todays->get($project->id);

            return [
                'projectId' => $project->id,
                'projectTitle' => $project->title,
                'location' => $project->location,
                'status' => $this->dayStatus($attendance),
                'checkInAt' => $attendance?->check_in_at?->toIso8601String(),
                'checkOutAt' => $attendance?->check_out_at?->toIso8601String(),
                'hours' => $attendance?->hours(),
            ];
        });

        $history = WorkerAttendance::where('worker_id', $worker->id)
            ->where('work_date', '>=', $this->daysAgo(self::HISTORY_DAYS))
            ->with('project:id,title')
            ->orderByDesc('work_date')
            ->orderByDesc('id')
            ->get()
            ->map(fn (WorkerAttendance $a) => $this->presentAttendance($a));

        return ['date' => $this->today(), 'today' => $today->values()->all(), 'history' => $history->values()->all()];
    }

    /**
     * @return array<string, mixed>
     *
     * @throws ValidationException
     */
    public function checkIn(Project $project, User $worker): array
    {
        $this->assertWorking($project, $worker);

        $attendance = WorkerAttendance::firstOrCreate(
            ['project_id' => $project->id, 'worker_id' => $worker->id, 'work_date' => $this->today()],
            ['check_in_at' => now()]
        );

        if (! $attendance->wasRecentlyCreated) {
            throw ValidationException::withMessages(['project_id' => 'You already checked in on this project today.']);
        }

        return $this->presentAttendance($attendance->load('project:id,title'));
    }

    /**
     * @return array<string, mixed>
     *
     * @throws ValidationException
     */
    public function checkOut(Project $project, User $worker): array
    {
        $this->assertWorking($project, $worker);

        $attendance = WorkerAttendance::where('project_id', $project->id)
            ->where('worker_id', $worker->id)
            ->where('work_date', $this->today())
            ->first();

        if (! $attendance) {
            throw ValidationException::withMessages(['project_id' => 'Check in on this project before checking out.']);
        }
        if ($attendance->check_out_at) {
            throw ValidationException::withMessages(['project_id' => 'You already checked out of this project today.']);
        }

        $attendance->update(['check_out_at' => now()]);

        return $this->presentAttendance($attendance->load('project:id,title'));
    }

    /**
     * @return array<string, mixed>
     */
    private function presentAttendance(WorkerAttendance $attendance): array
    {
        return [
            'id' => $attendance->id,
            'projectId' => $attendance->project_id,
            'projectTitle' => $attendance->project?->title,
            'date' => $attendance->work_date,
            'status' => $this->dayStatus($attendance),
            'checkInAt' => $attendance->check_in_at?->toIso8601String(),
            'checkOutAt' => $attendance->check_out_at?->toIso8601String(),
            'hours' => $attendance->hours(),
        ];
    }

    // ---- daily work log ------------------------------------------------------------------------

    /**
     * The worker's active projects (with today's entry, if written) and their last month of logs.
     *
     * @return array<string, mixed>
     */
    public function workLogsFor(User $worker): array
    {
        $logs = WorkerWorkLog::where('worker_id', $worker->id)
            ->where('log_date', '>=', $this->daysAgo(self::HISTORY_DAYS))
            ->with('project:id,title')
            ->orderByDesc('log_date')
            ->orderByDesc('id')
            ->get();

        $todays = $logs->where('log_date', $this->today())->keyBy('project_id');

        return [
            'date' => $this->today(),
            'projects' => $this->activeProjectsOf($worker)->map(fn (Project $project) => [
                'projectId' => $project->id,
                'projectTitle' => $project->title,
                'todayLog' => $todays->get($project->id)?->summary,
            ])->values()->all(),
            'logs' => $logs->map(fn (WorkerWorkLog $log) => $this->presentLog($log))->values()->all(),
        ];
    }

    /**
     * Writes (or corrects) the worker's log for a day — today, or up to a week back.
     *
     * @return array<string, mixed>
     *
     * @throws ValidationException
     */
    public function saveLog(Project $project, User $worker, string $summary, ?string $date = null): array
    {
        $this->assertWorking($project, $worker);

        $date ??= $this->today();
        if ($date > $this->today() || $date < $this->daysAgo(self::LOG_BACKDATE_DAYS)) {
            throw ValidationException::withMessages(['log_date' => 'A daily log can be written for today or the past '.self::LOG_BACKDATE_DAYS.' days.']);
        }

        $log = WorkerWorkLog::updateOrCreate(
            ['project_id' => $project->id, 'worker_id' => $worker->id, 'log_date' => $date],
            ['summary' => trim($summary)]
        );

        return $this->presentLog($log->load('project:id,title'));
    }

    /**
     * @return array<string, mixed>
     */
    private function presentLog(WorkerWorkLog $log): array
    {
        return [
            'id' => $log->id,
            'projectId' => $log->project_id,
            'projectTitle' => $log->project?->title,
            'date' => $log->log_date,
            'summary' => $log->summary,
        ];
    }

    // ---- earnings ------------------------------------------------------------------------------

    /**
     * What the worker has earned on each project they're on (or were on), from the days they
     * checked in and the wage agreed for them.
     *
     * @return array<string, mixed>
     */
    public function earningsFor(User $worker): array
    {
        $projects = Project::query()
            ->whereHas('workers', fn ($q) => $q->whereKey($worker->id))
            ->with(['workers' => fn ($q) => $q->whereKey($worker->id)])
            ->get();
        $attendance = WorkerAttendance::where('worker_id', $worker->id)->get()->groupBy('project_id');

        $items = $projects->map(function (Project $project) use ($attendance) {
            $wage = Wage::fromPivot($project->workers->first()?->pivot);
            $records = $attendance->get($project->id, collect());

            return [
                'projectId' => $project->id,
                'projectTitle' => $project->title,
                'status' => $project->status,
                'wage' => $wage,
                'daysWorked' => $records->count(),
                'hoursWorked' => round($records->sum(fn (WorkerAttendance $a) => $a->hours() ?? 0), 2),
                'earned' => $this->earnedFor($wage, $records->count()),
            ];
        })->sortBy([['status', 'asc'], ['projectTitle', 'asc']])->values();

        return [
            'projects' => $items->all(),
            'totals' => [
                'daysWorked' => $items->sum('daysWorked'),
                'hoursWorked' => round($items->sum('hoursWorked'), 2),
                'earned' => (int) $items->sum('earned'),
            ],
        ];
    }

    /**
     * @param  array{amount: int, unit: string, days: int|null, total: int, auto: bool}|null  $wage
     */
    private function earnedFor(?array $wage, int $days): ?int
    {
        return $wage !== null && $wage['unit'] === Wage::PER_DAY ? $wage['amount'] * $days : null;
    }

    // ---- the team's view -----------------------------------------------------------------------

    /**
     * Every worker on the project: today's attendance, days worked, earnings so far and their
     * latest daily logs — for the homeowner and the contractors running it.
     *
     * @return array<string, mixed>
     *
     * @throws ValidationException
     */
    public function teamActivity(Project $project, User $acting): array
    {
        if (! $project->canManageTeam($acting)) {
            throw ValidationException::withMessages(['project_id' => 'You cannot view this project\'s team activity.']);
        }

        $project->load('workers');
        $attendance = WorkerAttendance::where('project_id', $project->id)->get()->groupBy('worker_id');
        $logs = WorkerWorkLog::where('project_id', $project->id)
            ->where('log_date', '>=', $this->daysAgo(self::TEAM_LOG_DAYS))
            ->orderByDesc('log_date')
            ->orderByDesc('id')
            ->get()
            ->groupBy('worker_id');
        $today = $this->today();

        $workers = $project->workers->map(function (User $worker) use ($attendance, $logs, $today) {
            $records = $attendance->get($worker->id, collect());
            $todays = $records->firstWhere('work_date', $today);
            $wage = Wage::fromPivot($worker->pivot);

            return [
                'id' => $worker->id,
                'name' => $worker->name,
                'wage' => $wage,
                'today' => [
                    'status' => $this->dayStatus($todays),
                    'checkInAt' => $todays?->check_in_at?->toIso8601String(),
                    'checkOutAt' => $todays?->check_out_at?->toIso8601String(),
                ],
                'daysWorked' => $records->count(),
                'hoursWorked' => round($records->sum(fn (WorkerAttendance $a) => $a->hours() ?? 0), 2),
                'earned' => $this->earnedFor($wage, $records->count()),
                'recentLogs' => $logs->get($worker->id, collect())->take(5)
                    ->map(fn (WorkerWorkLog $log) => ['id' => $log->id, 'date' => $log->log_date, 'summary' => $log->summary])
                    ->values()->all(),
            ];
        })->sortBy('name')->values();

        return [
            'projectId' => $project->id,
            'title' => $project->title,
            'date' => $today,
            'workers' => $workers->all(),
        ];
    }
}
