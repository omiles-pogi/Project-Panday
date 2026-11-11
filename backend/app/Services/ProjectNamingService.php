<?php

namespace App\Services;

use App\Models\Project;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ProjectNamingService
{
    public function save(Project $project, User $owner, string $name): array
    {
        abort_unless($owner->role === 'homeowner', 403);

        return DB::transaction(function () use ($project, $owner, $name) {
            $locked = $owner->projects()->whereKey($project->id)->lockForUpdate()->firstOrFail();
            if ($locked->status === 'not_started' || ! $locked->approved_plan) {
                throw ValidationException::withMessages(['project_id' => 'Finalize the construction plan before naming this project.']);
            }
            // First successful save wins. A lost-response retry of that same name is harmless.
            if ($locked->projectNamePending() !== true && $locked->title !== $name) {
                throw ValidationException::withMessages(['name' => 'This project already has a saved name. Reopen the conversation to refresh it.']);
            }
            if ($locked->projectNamePending() === true) {
                $plan = $locked->approved_plan;
                $plan['projectTitle'] = $name;
                $plan['_projectNamePending'] = false;
                $locked->update(['title' => $name, 'approved_plan' => $plan]);
            }

            return ['id' => $locked->id, 'title' => $locked->title, 'status' => $locked->status, 'projectNamePending' => $locked->projectNamePending()];
        });
    }
}
