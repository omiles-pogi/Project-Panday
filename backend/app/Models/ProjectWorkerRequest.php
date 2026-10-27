<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['project_id', 'worker_id', 'initiated_by', 'invited_by_user_id', 'status'])]
class ProjectWorkerRequest extends Model
{
    public const STATUSES = ['pending', 'approved', 'rejected'];

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function worker(): BelongsTo
    {
        return $this->belongsTo(User::class, 'worker_id');
    }

    public function isPending(): bool
    {
        return $this->status === 'pending';
    }

    /** True if the homeowner started this (an invite the worker must accept/decline). */
    public function isHomeownerInitiated(): bool
    {
        return $this->initiated_by === 'homeowner';
    }
}
