<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** One supplier's share of an approved material request, and its fulfillment status. */
#[Fillable(['material_request_id', 'supplier_id', 'status', 'expected_delivery_date', 'supplier_note', 'decline_reason', 'confirmed_at', 'received_at'])]
class SupplierFulfillment extends Model
{
    public const SUPPLIER_REVIEW = 'supplier_review';

    public const AWAITING_HOMEOWNER = 'awaiting_homeowner_confirmation';

    public const CONFIRMED = 'confirmed';

    public const RECEIVED = 'received';

    public const UNAVAILABLE = 'unavailable';

    public const CANCELLED = 'cancelled';

    /** Statuses in which this fulfillment's items hold reserved stock. */
    public const HOLDS_RESERVATION = [self::AWAITING_HOMEOWNER, self::CONFIRMED];

    /** Ended without fulfilment — its items return to the contractor for revision. */
    public const DEAD = [self::UNAVAILABLE, self::CANCELLED];

    protected function casts(): array
    {
        return [
            'expected_delivery_date' => 'date',
            'confirmed_at' => 'datetime',
            'received_at' => 'datetime',
        ];
    }

    public function materialRequest(): BelongsTo
    {
        return $this->belongsTo(MaterialRequest::class);
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'supplier_id');
    }

    public function items(): HasMany
    {
        // Explicit FK: the column is still named supplier_order_id (unchanged by this rename), so
        // Eloquent's own inference from this class's name (supplier_fulfillment_id) would be wrong.
        return $this->hasMany(MaterialRequestItem::class, 'supplier_order_id')->orderBy('id');
    }

    public function isDead(): bool
    {
        return in_array($this->status, self::DEAD, true);
    }
}
