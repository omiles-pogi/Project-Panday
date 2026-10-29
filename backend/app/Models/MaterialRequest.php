<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A contractor's material list for one project. `status` tracks only approval; each supplier's
 * fulfillment progress is a SupplierOrder, so the two can never contradict each other.
 */
#[Fillable(['project_id', 'contractor_id', 'homeowner_id', 'status', 'notes', 'decision_reason', 'estimated_total', 'submitted_at', 'approved_at'])]
class MaterialRequest extends Model
{
    public const DRAFT = 'draft';

    public const PENDING = 'pending_homeowner_approval';

    public const REVISION = 'revision_requested';

    public const APPROVED = 'approved';

    public const COMPLETED = 'completed';

    public const REJECTED = 'rejected';

    public const CANCELLED = 'cancelled';

    /** States in which the contractor may change items and (re)submit. */
    public const EDITABLE = [self::DRAFT, self::REVISION];

    /** No further action is possible from these. */
    public const CLOSED = [self::COMPLETED, self::REJECTED, self::CANCELLED];

    protected function casts(): array
    {
        return [
            'estimated_total' => 'integer',
            'submitted_at' => 'datetime',
            'approved_at' => 'datetime',
        ];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function contractor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'contractor_id');
    }

    public function homeowner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'homeowner_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(MaterialRequestItem::class)->orderBy('id');
    }

    public function orders(): HasMany
    {
        return $this->hasMany(SupplierOrder::class)->orderBy('id');
    }

    public function statusLogs(): HasMany
    {
        return $this->hasMany(MaterialRequestStatusLog::class)->orderBy('id');
    }

    public function isEditable(): bool
    {
        return in_array($this->status, self::EDITABLE, true);
    }
}
