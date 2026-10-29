<?php

namespace App\Services;

use App\Models\SupplierProduct;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\ModelNotFoundException;
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
        return $supplier->supplierProducts()->create($data);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function update(SupplierProduct $product, User $actingUser, array $data): SupplierProduct
    {
        $this->authorizeOwner($product, $actingUser);

        // Reserved units are already promised to confirmed orders — on-hand can't drop below them.
        if (isset($data['stock']) && $data['stock'] < $product->reserved) {
            throw ValidationException::withMessages([
                'stock' => "{$product->reserved} {$product->unit} are reserved for confirmed orders, so stock cannot be set below that.",
            ]);
        }

        $product->update($data);

        return $product;
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
        $search = trim((string) ($filters['search'] ?? ''));
        $stock = $filters['stock'] ?? null;

        return SupplierProduct::query()
            ->listed()
            ->with('supplier:id,name,business_name')
            ->when($search !== '', fn (Builder $q) => $q->where('name', 'like', '%'.addcslashes($search, '%_\\').'%'))
            ->when($filters['category'] ?? null, fn (Builder $q, string $category) => $q->where('category', $category))
            // Compared column-to-column (not `stock - reserved`) so MySQL never evaluates an unsigned
            // subtraction; "in stock" means available-to-promise > 0.
            ->when($stock === 'in_stock', fn (Builder $q) => $q->whereColumn('stock', '>', 'reserved'))
            ->when($stock === 'out_of_stock', fn (Builder $q) => $q->whereColumn('stock', '<=', 'reserved'))
            ->orderByRaw('CASE WHEN stock > reserved THEN 0 ELSE 1 END')
            ->orderBy('name')
            ->limit(200)
            ->get();
    }

    /** A single catalog listing — 404s for a deactivated listing or an unapproved supplier. */
    public function catalogItem(SupplierProduct $product): SupplierProduct
    {
        if (! SupplierProduct::query()->listed()->whereKey($product->id)->exists()) {
            throw (new ModelNotFoundException)->setModel(SupplierProduct::class, [$product->id]);
        }

        return $product->load('supplier:id,name,business_name');
    }

    private function authorizeOwner(SupplierProduct $product, User $actingUser): void
    {
        if ($product->supplier_id !== $actingUser->id) {
            throw ValidationException::withMessages(['product_id' => 'This is not your listing.']);
        }
    }

    /**
     * A compact, prompt-ready list of real current supplier prices — the cheapest active listing
     * per distinct product name, across every supplier. Feeds the AI material estimator so
     * materials[].unitPrice is grounded in actual marketplace prices where one exists, instead of
     * an always-guessed figure.
     *
     * Capped at 80 entries: this shop is realistically never that large for a thesis demo, and
     * capping keeps the prompt's token cost bounded regardless of catalog growth.
     */
    public function pricingContextForPrompt(): string
    {
        $cheapestPerName = SupplierProduct::query()
            ->where('is_active', true)
            ->orderBy('price')
            ->get(['name', 'unit', 'price', 'stock'])
            ->unique(fn (SupplierProduct $p) => mb_strtolower(trim($p->name)))
            ->take(80);

        if ($cheapestPerName->isEmpty()) {
            return '';
        }

        $lines = $cheapestPerName
            ->map(fn (SupplierProduct $p) => "- {$p->name} ({$p->unit}): ₱{$p->price}")
            ->implode("\n");

        return "\n\nCurrent supplier-listed prices in the marketplace (PHP, per unit). Use one of these for a material's unitPrice whenever it matches (same or clearly equivalent item, case-insensitive) — only estimate a realistic market price for materials with no match below:\n{$lines}";
    }
}
