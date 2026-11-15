<?php

namespace App\Services;

use App\Models\SupplierProduct;
use App\Models\User;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Collection as SupportCollection;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SupplierProductService
{
    /**
     * @return Collection<int, SupplierProduct>
     */
    public function listForSupplier(User $supplier): Collection
    {
        return $supplier->supplierProducts()->latest()->get();
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function create(User $supplier, array $data): SupplierProduct
    {
        $this->approvedSupplier($supplier);
        // A new zero-stock/unknown listing can be saved as a draft without being advertised.
        $candidate = new SupplierProduct($data);
        if (SupplierProduct::hasStockConfirmationSchema()) {
            // Saving a quantity is separate from explicitly attesting physical verification.
            $candidate->forceFill(['stock_is_confirmed' => false]);
        }
        $data['is_active'] = ($data['is_active'] ?? true) && $candidate->activation_eligible;

        $product = $supplier->supplierProducts()->make($data);
        if (SupplierProduct::hasStockConfirmationSchema()) {
            $product->forceFill(['stock_is_confirmed' => false]);
        }
        $product->save();

        return $product;
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function update(SupplierProduct $product, User $actingUser, array $data): SupplierProduct
    {
        return DB::transaction(function () use ($product, $actingUser, $data) {
            $this->approvedSupplier($actingUser, lock: true);
            $locked = SupplierProduct::query()->whereKey($product->id)->lockForUpdate()->firstOrFail();
            $this->authorizeOwner($locked, $actingUser);
            if (isset($data['stock']) && $data['stock'] < $locked->reserved) {
                throw ValidationException::withMessages([
                    'stock' => "{$locked->reserved} {$locked->unit} are reserved for confirmed orders, so stock cannot be set below that.",
                ]);
            }
            $activating = ! $locked->is_active && ($data['is_active'] ?? false);
            $quantityChanged = array_key_exists('stock', $data) && (int) $data['stock'] !== $locked->stock;
            $unknownNoteEdited = ! $locked->stock_confirmed && array_key_exists('description', $data);
            if (SupplierProduct::hasStockConfirmationSchema() && ($quantityChanged || $unknownNoteEdited)) {
                // Manual quantity changes require a new attestation. Keep the last audit snapshot.
                // Normal reservation/delivery stock movements use StockService and do not invalidate it.
                $locked->forceFill(['stock_is_confirmed' => false]);
            }
            $locked->fill($data);
            if ($activating && ! $locked->activation_eligible) {
                throw ValidationException::withMessages(['is_active' => $locked->activation_block_reason]);
            }
            $locked->save();

            return $locked;
        }, 3);
    }

    /** All rows are scoped to the signed-in supplier, regardless of client filters or IDs. */
    public function bulkActivation(User $supplier, bool $activate): array
    {
        return DB::transaction(function () use ($supplier, $activate) {
            $this->approvedSupplier($supplier, lock: true);
            // Same row locks used by concurrent reservation/stock updates; recheck eligibility here.
            $products = $supplier->supplierProducts()->orderBy('id')->lockForUpdate()->get();
            $updated = 0;
            $reasons = [];
            foreach ($products as $product) {
                $reason = $product->is_active === $activate ? ($activate ? 'already_active' : 'already_inactive')
                    : ($activate ? $product->activationFailure() : null);
                if ($reason !== null) {
                    $reasons[$reason] = ($reasons[$reason] ?? 0) + 1;

                    continue;
                }
                $product->update(['is_active' => $activate]);
                $updated++;
            }

            return ['total' => $products->count(), 'updated' => $updated,
                'skipped' => $products->count() - $updated, 'failed' => 0,
                'skipped_reasons' => $reasons, 'products' => $products];
        }, 3);
    }

    private function approvedSupplier(User $user, bool $lock = false): void
    {
        $query = User::query()->whereKey($user->id);
        $current = ($lock ? $query->lockForUpdate() : $query)->firstOrFail();
        abort_unless($current->role === 'supplier' && $current->approval_status === 'approved', 403,
            'Only an approved supplier account can manage product availability.');
    }

    /** Read-only review, signed and bound to this supplier and the exact recorded inventory. */
    public function stockConfirmationReview(User $supplier): array
    {
        $this->approvedSupplier($supplier);
        abort_unless(SupplierProduct::hasStockConfirmationSchema(), 503, 'Stock confirmation requires the approved database update. No inventory was changed.');
        $products = $supplier->supplierProducts()->where(function (Builder $q) {
            $q->whereNull('stock_is_confirmed')->orWhere('stock_is_confirmed', false);
        })->orderBy('id')->get();
        $token = Crypt::encryptString(json_encode([
            'purpose' => 'supplier-stock-confirmation-v1',
            'supplier_id' => $supplier->id, 'ids' => $products->modelKeys(),
            'fingerprint' => $this->stockReviewFingerprint($products), 'expires_at' => now()->addMinutes(10)->timestamp,
        ], JSON_THROW_ON_ERROR));

        return ['review_token' => $token, 'count' => $products->count(), 'products' => $products->map(fn ($p) => [
            'id' => $p->id, 'name' => $p->name, 'stock' => $p->stock, 'reserved' => $p->reserved,
            'unit' => $p->unit, 'price' => $p->price, 'is_active' => $p->is_active,
        ])->values()];
    }

    public function confirmStock(User $supplier, string $token): array
    {
        abort_unless(SupplierProduct::hasStockConfirmationSchema(), 503, 'Stock confirmation requires the approved database update. No inventory was changed.');
        try {
            $review = json_decode(Crypt::decryptString($token), true, 512, JSON_THROW_ON_ERROR);
        } catch (DecryptException|\JsonException $e) {
            throw ValidationException::withMessages(['review_token' => 'Invalid stock review. Review your inventory again.']);
        }
        if (($review['purpose'] ?? null) !== 'supplier-stock-confirmation-v1' || ($review['supplier_id'] ?? null) !== $supplier->id || ($review['expires_at'] ?? 0) < now()->timestamp) {
            throw ValidationException::withMessages(['review_token' => 'This review expired or belongs to another supplier. Review again.']);
        }

        return DB::transaction(function () use ($supplier, $review) {
            $this->approvedSupplier($supplier, lock: true);
            $products = $supplier->supplierProducts()->whereIn('id', $review['ids'])->orderBy('id')->lockForUpdate()->get();
            if ($products->count() !== count($review['ids']) || ! hash_equals($review['fingerprint'], $this->stockReviewFingerprint($products))) {
                throw ValidationException::withMessages(['review_token' => 'Inventory changed since review. No stock was confirmed. Review the latest quantities again.']);
            }
            $updated = 0;
            foreach ($products as $p) {
                if ($p->stock_is_confirmed === true) {
                    continue;
                }
                // Never change activation, quantities, pricing, descriptions, or source provenance.
                $p->forceFill(['stock_is_confirmed' => true, 'stock_confirmed_at' => now(),
                    'stock_confirmed_by' => $supplier->id, 'stock_confirmed_quantity' => $p->stock])->save();
                $updated++;
            }

            return ['total' => $products->count(), 'updated' => $updated, 'skipped' => $products->count() - $updated,
                'failed' => 0, 'products' => $this->listForSupplier($supplier)];
        }, 3);
    }

    private function stockReviewFingerprint(Collection $products): string
    {
        $ignored = array_flip(['updated_at', 'stock_is_confirmed', 'stock_confirmed_at', 'stock_confirmed_by', 'stock_confirmed_quantity']);

        // Ignoring only the attestation permits harmless retry after a lost confirmation response.
        return hash('sha256', json_encode($products->map(fn ($p) => array_diff_key($p->getAttributes(), $ignored))->all(), JSON_THROW_ON_ERROR));
    }

    public function delete(SupplierProduct $product, User $actingUser): void
    {
        $this->authorizeOwner($product, $actingUser);

        if ($product->reserved > 0) {
            throw ValidationException::withMessages([
                'product_id' => 'This material has stock reserved for confirmed orders. Deactivate it instead, or finish those orders first.',
            ]);
        }

        $product->delete();
    }

    /**
     * The homeowner/contractor material catalog: every listed product across suppliers, with the
     * supplier's public details. In-stock items sort first; out-of-stock ones stay visible so
     * buyers can see the item exists, flagged as unavailable.
     *
     * Capped at 200 rows — search/filters narrow it down, and an unbounded list would only slow
     * the phone down.
     *
     * @param  array{search?: ?string, category?: ?string, stock?: ?string}  $filters
     * @return Collection<int, SupplierProduct>
     */
    public function catalog(array $filters): Collection
    {
        $words = preg_split('/\s+/', mb_strtolower(trim((string) ($filters['search'] ?? ''))), -1, PREG_SPLIT_NO_EMPTY) ?: [];

        // Every word must be in the name, in any order. When none is (an AI-written name like "Portland cement
        // 40kg bag" rarely matches a listing word for word), show what has most of the words instead of nothing.
        $found = $this->catalogQuery($filters, $words, all: true)->get();
        if ($found->isEmpty() && count($words) > 1) {
            $found = $this->catalogQuery($filters, array_filter($words, fn (string $w) => mb_strlen($w) >= 3), all: false)->get()
                ->sortByDesc(fn (SupplierProduct $p) => count(array_filter($words, fn (string $w) => str_contains(mb_strtolower($p->name), $w))))
                ->values();
        }

        return $found;
    }

    /**
     * @param  array{category?: ?string, stock?: ?string}  $filters
     * @param  array<int, string>  $words  lower-case search words
     * @param  bool  $all  every word must match the name (else any one of them)
     * @return Builder<SupplierProduct>
     */
    private function catalogQuery(array $filters, array $words, bool $all): Builder
    {
        $stock = $filters['stock'] ?? null;

        return SupplierProduct::query()
            ->listed()
            ->with(['supplier:id,name,business_name', 'supplier.supplierProfile:id,user_id,location,contact_number'])
            ->when($words !== [], fn (Builder $q) => $q->where(function (Builder $q) use ($words, $all) {
                foreach ($words as $word) {
                    $q->where('name', 'like', '%'.addcslashes($word, '%_\\').'%', $all ? 'and' : 'or');
                }
            }))
            ->when($filters['category'] ?? null, fn (Builder $q, string $category) => $q->where('category', $category))
            // Compared column-to-column (not `stock - reserved`) so MySQL never evaluates an unsigned
            // subtraction; "in stock" means available-to-promise > 0.
            ->when($stock === 'in_stock', fn (Builder $q) => $q->whereColumn('stock', '>', 'reserved'))
            ->when($stock === 'out_of_stock', fn (Builder $q) => $q->whereColumn('stock', '<=', 'reserved'))
            ->orderByRaw('CASE WHEN stock > reserved THEN 0 ELSE 1 END')
            ->orderBy('name')
            ->limit(200);
    }

    /** A single catalog listing — 404s for a deactivated listing or an unapproved supplier. */
    public function catalogItem(SupplierProduct $product): SupplierProduct
    {
        if (! SupplierProduct::query()->listed()->whereKey($product->id)->exists()) {
            throw (new ModelNotFoundException)->setModel(SupplierProduct::class, [$product->id]);
        }

        return $product->load(['supplier:id,name,business_name', 'supplier.supplierProfile:id,user_id,location,contact_number']);
    }

    private function authorizeOwner(SupplierProduct $product, User $actingUser): void
    {
        if ($product->supplier_id !== $actingUser->id) {
            throw ValidationException::withMessages(['product_id' => 'This is not your listing.']);
        }
    }

    /**
     * Prompt-size caps: every row costs tokens against the AI's per-minute limit, and what the listings
     * use is taken from the room left for the plan itself. Rows are spread across listing categories
     * (see spread()), so a dozen still cover the staples even when a supplier lists ~90 items.
     */
    private const CHOSEN_SUPPLIER_ROWS = 12;

    private const AUTO_ROWS = 8;

    /**
     * Who can supply each of the plan's three supplier-sourced categories, for the homeowner's
     * picker: approved suppliers with at least one active listing in that category.
     *
     * @return array<int, array{category: string, suppliers: array<int, array{id: int, name: string, itemCount: int, inStockCount: int}>}>
     */
    public function supplierOptions(): array
    {
        $products = SupplierProduct::query()->availableForSupply()->with('supplier:id,name,business_name')->get();

        return collect(SupplierProduct::PLAN_CATEGORIES)->map(function (array $listingCategories, string $planCategory) use ($products) {
            $suppliers = $products->whereIn('category', $listingCategories)
                ->groupBy('supplier_id')
                ->map(fn (Collection $items) => [
                    'id' => $items->first()->supplier_id,
                    'name' => $this->supplierName($items->first()),
                    'itemCount' => $items->count(),
                    'inStockCount' => $items->filter(fn (SupplierProduct $p) => $p->available_quantity > 0)->count(),
                ])
                ->sortByDesc('inStockCount')
                ->values()
                ->all();

            return ['category' => $planCategory, 'suppliers' => $suppliers];
        })->values()->all();
    }

    /**
     * The real supplier listings the AI must price from, as prompt text. For each of the three
     * supplier-sourced plan categories: the chosen supplier's in-stock items (and only those), or —
     * when the homeowner hasn't chosen — the cheapest in-stock listing per item across suppliers.
     * Every row carries its listing id so the AI can say exactly which listing a material is, and
     * the server can then check that claim (see ConstructionPlanService::applySupplierData).
     *
     * @param  array<string, int|null>  $selections  Plan category => chosen supplier id.
     */
    public function pricingContextForPrompt(array $selections = []): string
    {
        $inStock = SupplierProduct::query()->availableForSupply()->with('supplier:id,name,business_name')
            ->orderBy('price')->get()
            ->filter(fn (SupplierProduct $p) => $p->available_quantity > 0);

        if ($inStock->isEmpty()) {
            return '';
        }

        $sections = [];
        foreach (SupplierProduct::PLAN_CATEGORIES as $planCategory => $listingCategories) {
            $inCategory = $inStock->whereIn('category', $listingCategories);
            $chosenId = $selections[$planCategory] ?? null;

            if ($chosenId) {
                $rows = $this->spread($inCategory->where('supplier_id', $chosenId), self::CHOSEN_SUPPLIER_ROWS);
                $name = $rows->first() ? $this->supplierName($rows->first()) : "supplier #{$chosenId}";
                $header = $rows->isEmpty()
                    ? "[{$planCategory}] the homeowner chose {$name}, who has nothing in stock here — estimate these prices and set supplierProductId 0."
                    : "[{$planCategory}] the homeowner chose {$name} — use ONLY these listings for this category:";
                $lines = $rows->map(fn (SupplierProduct $p) => "{$p->id} | {$p->name} | {$p->unit} | ₱{$p->price}");
            } else {
                $rows = $this->spread($inCategory->unique(fn (SupplierProduct $p) => mb_strtolower(trim($p->name))), self::AUTO_ROWS);
                $header = "[{$planCategory}] no supplier chosen — the cheapest in-stock listing per item:";
                $lines = $rows->map(fn (SupplierProduct $p) => "{$p->id} | {$p->name} | {$p->unit} | ₱{$p->price} | {$this->supplierName($p)}");
            }

            if ($rows->isNotEmpty() || $chosenId) {
                $sections[] = $header.($lines->isEmpty() ? '' : "\n".$lines->implode("\n"));
            }
        }

        if ($sections === []) {
            return '';
        }

        return "\n\nREAL SUPPLIER LISTINGS (id | name | unit | price in PHP) — the only source for material prices:\n".implode("\n\n", $sections);
    }

    /**
     * At most $cap listings, taken round-robin across listing categories — the oldest listings of each
     * first — so a big catalog shows cement, sand, steel, roofing… rather than only the cheapest odds and
     * ends, which would leave the AI guessing prices the supplier really has. A supplier lists its main
     * lines first, and unlike price the order doesn't shift as prices change. Returned cheapest-first.
     *
     * @param  SupportCollection<int, SupplierProduct>  $rows
     * @return SupportCollection<int, SupplierProduct>
     */
    private function spread(SupportCollection $rows, int $cap): SupportCollection
    {
        $queues = $rows->groupBy('category')->map(fn ($group) => $group->sortBy('id')->values())->values();
        $picked = collect();

        for ($round = 0; $picked->count() < $cap; $round++) {
            $added = false;
            foreach ($queues as $queue) {
                if ($picked->count() < $cap && $queue->has($round)) {
                    $picked->push($queue[$round]);
                    $added = true;
                }
            }
            if (! $added) {
                break;
            }
        }

        return $picked->sortBy('price')->values();
    }

    private function supplierName(SupplierProduct $product): string
    {
        return $product->supplier->business_name ?: $product->supplier->name;
    }
}
