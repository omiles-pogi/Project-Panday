<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Schema;

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

    /**
     * The three AI-plan budget categories whose materials come from suppliers — the homeowner picks one
     * supplier for each — and the listing categories each one covers. Together they cover every
     * entry in CATEGORIES, so any listing belongs to exactly one.
     */
    public const PLAN_CATEGORIES = [
        'Construction Materials' => ['Cement', 'Sand', 'Gravel', 'Aggregate', 'Steel', 'Lumber', 'Masonry', 'Roofing', 'Hardware'],
        'Electrical and Plumbing' => ['Electrical', 'Plumbing'],
        'Finishing Works' => ['Paint', 'Other'],
    ];

    /** Which plan category a listing's own category falls under. */
    public static function planCategoryFor(string $listingCategory): ?string
    {
        foreach (self::PLAN_CATEGORIES as $planCategory => $listingCategories) {
            if (in_array($listingCategory, $listingCategories, true)) {
                return $planCategory;
            }
        }

        return null;
    }

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
    protected $appends = ['available_quantity', 'stock_status', 'activation_eligible', 'activation_block_reason', 'stock_confirmed'];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'price' => 'integer',
            'stock' => 'integer',
            'reserved' => 'integer',
            'min_order' => 'integer',
            'stock_is_confirmed' => 'boolean',
            'stock_confirmed_at' => 'datetime',
            'stock_confirmed_by' => 'integer',
            'stock_confirmed_quantity' => 'integer',
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

    /** Imported placeholder stock is not confirmed merely because its numeric quantity changed. */
    public function activationFailure(): ?string
    {
        if ($this->price <= 0) {
            return 'invalid_price';
        }
        if (! $this->stock_confirmed) {
            return 'unconfirmed_stock';
        }

        return $this->available_quantity > 0 ? null : 'out_of_stock';
    }

    protected function activationEligible(): Attribute
    {
        return Attribute::get(fn () => $this->activationFailure() === null);
    }

    protected function activationBlockReason(): Attribute
    {
        return Attribute::get(fn () => match ($this->activationFailure()) {
            'invalid_price' => 'Set a valid price greater than zero before activation.',
            'unconfirmed_stock' => 'Availability is unconfirmed. Review the recorded quantities and use Confirm Stock for All after physically verifying them.',
            'out_of_stock' => 'No unreserved stock is available. Restock before activation.',
            default => null,
        });
    }

    /** Shared pricing/confirmation rules; zero stock may still be displayed as unavailable in the catalog. */
    public function scopePricedAndConfirmed(Builder $query): void
    {
        $query->where('price', '>', 0)->where(function (Builder $confirmed) {
            if (self::hasStockConfirmationSchema()) {
                $confirmed->where('stock_is_confirmed', true)->orWhere(function (Builder $legacy) {
                    $legacy->whereNull('stock_is_confirmed')
                        ->whereRaw("LOWER(COALESCE(description, '')) NOT LIKE ?", ['%stock availability is unconfirmed%']);
                });
            } else {
                // Safe rollout: existing reads/activation keep working before the approved migration.
                $confirmed->whereRaw("LOWER(COALESCE(description, '')) NOT LIKE ?", ['%stock availability is unconfirmed%']);
            }
        });
    }

    public static function hasStockConfirmationSchema(): bool
    {
        return Schema::hasColumns('supplier_products', ['stock_is_confirmed', 'stock_confirmed_at', 'stock_confirmed_by', 'stock_confirmed_quantity']);
    }

    protected function stockConfirmed(): Attribute
    {
        return Attribute::get(function () {
            // Structured attestations override historical import notes without erasing them.
            if ($this->stock_is_confirmed !== null) {
                return $this->stock_is_confirmed;
            }

            // Null is untouched legacy data, not a newly created supplier attestation.
            return ! str_contains(mb_strtolower((string) $this->description), 'stock availability is unconfirmed');
        });
    }

    public function scopeAvailableForSupply(Builder $query): void
    {
        $query->listed()->whereColumn('stock', '>', 'reserved');
    }

    /** Listings shown in the homeowner/contractor catalog: active, from an approved supplier. */
    public function scopeListed(Builder $query): void
    {
        $query->where('is_active', true)->pricedAndConfirmed()
            ->whereHas('supplier', fn (Builder $q) => $q->where('role', 'supplier')->where('approval_status', 'approved'));
    }
}
