<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One worker's day on one project: when they checked in and, once they left, checked out.
 * `work_date` is the Philippine calendar day as a plain Y-m-d string (deliberately not cast).
 */
#[Fillable(['project_id', 'worker_id', 'work_date', 'check_in_at', 'check_out_at'])]
class WorkerAttendance extends Model
{
    protected function casts(): array
    {
        return [
            'check_in_at' => 'datetime',
            'check_out_at' => 'datetime',
        ];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function worker(): BelongsTo
    {
        return $this->belongsTo(User::class, 'worker_id');
    }

    /** Hours on site, once they've checked out; null while they're still there. */
    public function hours(): ?float
    {
        if (! $this->check_in_at || ! $this->check_out_at) {
            return null;
        }

        return round(abs($this->check_in_at->diffInMinutes($this->check_out_at)) / 60, 2);
    }
}
