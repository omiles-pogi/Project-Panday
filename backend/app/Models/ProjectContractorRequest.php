<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['project_id', 'contractor_id', 'initiated_by', 'status', 'quote_amount', 'estimated_days', 'message'])]
class ProjectContractorRequest extends Model
{
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
