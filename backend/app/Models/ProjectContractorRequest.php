<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['project_id', 'contractor_id', 'initiated_by', 'status', 'quote_amount', 'estimated_days', 'message'])]
class ProjectContractorRequest extends Model
{
    protected static function booted(): void
    {
        // pending_contractor_id mirrors contractor_id only while status is 'pending', and is null
        // otherwise — the unique index on (project_id, pending_contractor_id) that enforces "at
        // most one pending request per project+contractor" relies on this staying in sync on save.
        static::saving(function (self $request) {
            $request->pending_contractor_id = $request->status === 'pending' ? $request->contractor_id : null;
        });
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function contractor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'contractor_id');
    }

    public function isPending(): bool
    {
        return $this->status === 'pending';
    }

    /** True if the homeowner started this (an invite the contractor must accept/decline). */
    public function isHomeownerInitiated(): bool
    {
        return $this->initiated_by === 'homeowner';
    }
}
