<?php

namespace App\Console\Commands;

use App\Models\Project;
use App\Services\ScheduleAlertService;
use Illuminate\Console\Command;

class CheckProjectDelays extends Command
{
    protected $signature = 'projects:check-delays {--project= : Only this project id}';

    protected $description = 'Notify homeowners and contractors of projects that have fallen behind their AI schedule (each slip is announced once)';

    public function handle(ScheduleAlertService $alerts): int
    {
        $notified = 0;
        $checked = 0;

        Project::query()
            ->where('status', 'active')
            ->when($this->option('project'), fn ($q, $id) => $q->whereKey($id))
            ->chunkById(100, function ($projects) use ($alerts, &$notified, &$checked) {
                foreach ($projects as $project) {
                    $count = $alerts->check($project);
                    $checked++;
                    $notified += $count;
                    if ($count > 0) {
                        $this->line("  {$project->title} (#{$project->id}): {$count} ".($count === 1 ? 'person' : 'people').' notified');
                    }
                }
            });

        $this->info("Done — {$notified} ".($notified === 1 ? 'notification' : 'notifications')." sent across {$checked} active ".($checked === 1 ? 'project' : 'projects').'.');

        return self::SUCCESS;
    }
}
