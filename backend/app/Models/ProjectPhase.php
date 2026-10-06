<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['project_id', 'name', 'sort_order', 'weight_pct', 'progress_pct'])]
class ProjectPhase extends Model
{
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function tasks(): HasMany
    {
        return $this->hasMany(ProjectPhaseTask::class);
    }

    /** Recomputes and saves progress_pct from the checklist's done/total ratio. */
    public function recomputeProgress(): void
    {
        $total = $this->tasks()->count();
        if ($total === 0) {
            return;
        }

        $done = $this->tasks()->where('is_done', true)->count();
        $this->update(['progress_pct' => (int) round(($done / $total) * 100)]);
    }
}
