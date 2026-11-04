<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A worker's account of what they did on a project on one day. `log_date` is the Philippine
 * calendar day as a plain Y-m-d string (deliberately not cast).
 */
#[Fillable(['project_id', 'worker_id', 'log_date', 'summary'])]
class WorkerWorkLog extends Model
{
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function worker(): BelongsTo
    {
        return $this->belongsTo(User::class, 'worker_id');
    }
}
