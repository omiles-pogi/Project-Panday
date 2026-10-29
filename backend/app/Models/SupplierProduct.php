<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SupplierProduct extends Model
{
    public const CATEGORIES = [
        'Cement',
        'Sand',
        'Gravel',
        'Aggregate',
        'Steel',
        'Lumber',
        'Masonry',
        'Paint',
        'Electrical',
        'Plumbing',
        'Roofing',
        'Hardware',
        'Other',
    ];

    public const STOCK_STATUSES = ['in_stock', 'out_of_stock'];

    protected $fillable = [
        'supplier_id',
        'name',
        'category',
        'description',
        'unit',
        'price',
        'stock',
        'min_order',
        'is_active',
    ];

    /** Mirrors the column defaults so a freshly created listing serializes them too. */
    protected $attributes = [
        'is_active' => true,
        'min_order' => 1,
        'reserved' => 0,
    ];

    /** Always serialized so every client reads the same derived values instead of re-deriving them. */
    protected $appends = ['available_quantity', 'stock_status'];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'price' => 'integer',
            'stock' => 'integer',
            'reserved' => 'integer',
            'min_order' => 'integer',
        ];
    }

    /**
     * Available to promise = on-hand stock − units reserved by supplier-confirmed orders. This is
     * what buyers can still get, so it's what both the badge and request checks use.
     */
    protected function availableQuantity(): Attribute
    {
        return Attribute::get(fn () => max(0, (int) $this->stock - (int) $this->reserved));
    }

    /**
     * Derived from available-to-promise, never stored — a separate column could drift out of sync
     * with the quantities it's supposed to describe.
     */
    protected function stockStatus(): Attribute
    {
        return Attribute::get(fn () => $this->available_quantity > 0 ? 'in_stock' : 'out_of_stock');
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'supplier_id');
    }

    /** Listings shown in the homeowner/contractor catalog: active, from an approved supplier. */
    public function scopeListed(Builder $query): void
    {
        $query->where('is_active', true)
            ->whereHas('supplier', fn (Builder $q) => $q->where('role', 'supplier')->where('approval_status', 'approved'));
    }
}
