<?php

namespace App\Console\Commands;

use App\Models\Project;
use App\Services\WageService;
use Illuminate\Console\Command;

class FillWages extends Command
{
    protected $signature = 'wages:fill {--project= : Only this project id}';

    protected $description = 'Give every contractor and worker on a project a wage worked out automatically (existing manual wages are left alone)';

    public function handle(WageService $wages): int
    {
        $projects = Project::query()
            ->when($this->option('project'), fn ($q, $id) => $q->whereKey($id))
            ->get();

        $written = 0;
        foreach ($projects as $project) {
            $count = $wages->syncAutoWages($project);
            $written += $count;
            if ($count > 0) {
                $this->line("  {$project->title} (#{$project->id}): {$count} wage".($count === 1 ? '' : 's').' set');
            }
        }

        $this->info("Done — {$written} wage".($written === 1 ? '' : 's')." filled in across {$projects->count()} project".($projects->count() === 1 ? '' : 's').'.');

        return self::SUCCESS;
    }
}
