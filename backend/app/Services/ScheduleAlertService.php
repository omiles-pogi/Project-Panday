<?php

namespace App\Services;

use App\Models\Project;

/**
 * Tells the homeowner and the project's contractors when a project falls behind the AI schedule.
 * The levels are the calendar's own Slightly / Significantly Behind statuses, so an alert never
 * disagrees with the screen it points to.
 *
 * Each project remembers the worst level its team has already been told about
 * (projects.delay_alert_level): it is announced when the project first slips and again only if it
 * slips further. Recovering lowers the remembered level, so a later relapse alerts again. The level
 * moves with a single conditional UPDATE, so two checks running at once can't both send.
 */
class ScheduleAlertService
{
    private const LEVELS = ['slightly_behind' => 1, 'significantly_behind' => 2];

    public function __construct(
        private readonly TimelineService $timeline,
        private readonly NotificationService $notifications,
    ) {}

    /** Works the schedule out from scratch (for the scheduler). Returns how many people were notified. */
    public function check(Project $project): int
    {
        if ($project->status !== 'active') {
            return 0;
        }

        return $this->evaluate($project, $this->timeline->overallFor($project));
    }

    /**
     * @param  array<string, mixed>  $overall  A timeline's "overall" block.
     * @return int How many people were notified.
     */
    public function evaluate(Project $project, array $overall): int
    {
        if ($project->status !== 'active') {
            return 0;
        }

        $level = self::LEVELS[$overall['status']] ?? 0;
        $alerted = fn () => Project::query()->whereKey($project->id);

        // Recovered (fully, or part way): remember the lower level without alerting.
        $alerted()->where('delay_alert_level', '>', $level)->update(['delay_alert_level' => $level]);

        // Newly behind, or further behind than anyone was told: alert, once.
        if ($level === 0 || $alerted()->where('delay_alert_level', '<', $level)->update(['delay_alert_level' => $level]) === 0) {
            return 0;
        }

        return $this->notifyTeam($project, $overall, $level === self::LEVELS['significantly_behind']);
    }

    /** @param array<string, mixed> $overall */
    private function notifyTeam(Project $project, array $overall, bool $significantly): int
    {
        $gap = abs((int) $overall['variancePct']);
        $overdue = (int) $overall['tasks']['overdue'];

        $title = $significantly ? 'Project significantly behind schedule' : 'Project falling behind schedule';
        $body = "{$project->title} is {$gap}% behind the AI schedule"
            .($overdue > 0 ? ", with {$overdue} overdue ".($overdue === 1 ? 'task' : 'tasks') : '')
            .($significantly ? '. Action is needed to recover — open the calendar to see what slipped.' : '. Open the calendar to see what slipped.');

        // The people who can see the calendar: the homeowner and the contractors running the project.
        $project->loadMissing('user', 'contractors');
        $recipients = collect([$project->user])->merge($project->contractors)->filter()->unique('id');

        foreach ($recipients as $recipient) {
            $this->notifications->send($recipient, 'schedule_delay', $title, $body, [
                'projectId' => $project->id,
                'projectTitle' => $project->title,
                'scheduleStatus' => $overall['status'],
                'variancePct' => $overall['variancePct'],
                'overdueTasks' => $overdue,
            ]);
        }

        return $recipients->count();
    }
}
