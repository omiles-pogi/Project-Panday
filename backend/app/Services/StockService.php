<?php

namespace App\Services;

use App\Models\SupplierProduct;
use Illuminate\Support\Facades\DB;

/**
 * The only code that moves supplier stock. Each operation is a single conditional UPDATE, so the
 * database itself guarantees two orders can never reserve the same last units (the WHERE clause
 * re-checks availability atomically) and that nothing goes negative.
 *
 * Lifecycle: draft/approval touch nothing → supplier confirms: reserve → delivered: deduct
 * (stock and reserved both drop) → cancel/decline before delivery: release.
 */
class StockService
{
    /** Reserves $qty if that much is still available to promise. Returns false (no change) otherwise. */
    public function reserve(int $productId, int $qty): bool
    {
        if ($qty <= 0) {
            return true;
        }

        return SupplierProduct::query()
            ->whereKey($productId)
            ->whereRaw('stock >= reserved + ?', [$qty])
            ->increment('reserved', $qty) === 1;
    }

    /** Gives back a reservation (cancel/decline). Never drops `reserved` below zero. */
    public function release(int $productId, int $qty): void
    {
        if ($qty <= 0) {
            return;
        }

        SupplierProduct::query()
            ->whereKey($productId)
            ->update(['reserved' => DB::raw('CASE WHEN reserved >= '.(int) $qty.' THEN reserved - '.(int) $qty.' ELSE 0 END')]);
    }

    /**
     * Delivery: the reserved units physically leave inventory. Returns false if the listing no
     * longer holds that reservation (e.g. it was deleted), so the caller can refuse the change.
     */
    public function deduct(int $productId, int $qty): bool
    {
        if ($qty <= 0) {
            return true;
        }

        return SupplierProduct::query()
            ->whereKey($productId)
            ->where('reserved', '>=', $qty)
            ->where('stock', '>=', $qty)
            ->decrementEach(['stock' => $qty, 'reserved' => $qty]) === 1;
    }
}
