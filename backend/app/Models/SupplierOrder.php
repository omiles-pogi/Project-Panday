<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** One supplier's share of an approved material request, and its fulfillment status. */
#[Fillable(['material_request_id', 'supplier_id', 'status', 'expected_delivery_date', 'supplier_note', 'decline_reason', 'confirmed_at', 'delivered_at', 'received_at'])]
class SupplierOrder extends Model
{
    public const SUPPLIER_REVIEW = 'supplier_review';

    public const AWAITING_HOMEOWNER = 'awaiting_homeowner_confirmation';

    public const CONFIRMED = 'confirmed';

    public const PREPARING = 'preparing';

    public const FOR_DELIVERY = 'for_delivery';

    public const DELIVERED = 'delivered';

    public const RECEIVED = 'received';

    public const UNAVAILABLE = 'unavailable';

    public const CANCELLED = 'cancelled';

    /** Statuses in which this order's items hold reserved stock. */
    public const HOLDS_RESERVATION = [self::AWAITING_HOMEOWNER, self::CONFIRMED, self::PREPARING, self::FOR_DELIVERY];

    /** Ended without fulfilment — its items return to the contractor for revision. */
    public const DEAD = [self::UNAVAILABLE, self::CANCELLED];

    /** The only forward moves a supplier can make once an order is confirmed. */
    public const SUPPLIER_TRANSITIONS = [
        self::CONFIRMED => self::PREPARING,
        self::PREPARING => self::FOR_DELIVERY,
        self::FOR_DELIVERY => self::DELIVERED,
    ];

    protected function casts(): array
    {
        return [
            'expected_delivery_date' => 'date',
            'confirmed_at' => 'datetime',
            'delivered_at' => 'datetime',
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
        return $this->hasMany(MaterialRequestItem::class)->orderBy('id');
    }

    public function isDead(): bool
    {
        return in_array($this->status, self::DEAD, true);
    }
}
