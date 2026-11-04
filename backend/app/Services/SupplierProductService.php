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

    /** Prompt-size caps: every row costs tokens against the AI's per-minute limit. */
    private const CHOSEN_SUPPLIER_ROWS = 24;

    private const AUTO_ROWS = 10;

    /**
     * Who can supply each of the plan's three supplier-sourced categories, for the homeowner's
     * picker: approved suppliers with at least one active listing in that category.
     *
     * @return array<int, array{category: string, suppliers: array<int, array{id: int, name: string, itemCount: int, inStockCount: int}>}>
     */
    public function supplierOptions(): array
    {
        $products = SupplierProduct::query()->listed()->with('supplier:id,name,business_name')->get();

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
        $inStock = SupplierProduct::query()->listed()->with('supplier:id,name,business_name')
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
                $rows = $inCategory->where('supplier_id', $chosenId)->take(self::CHOSEN_SUPPLIER_ROWS);
                $name = $rows->first() ? $this->supplierName($rows->first()) : "supplier #{$chosenId}";
                $header = $rows->isEmpty()
                    ? "[{$planCategory}] the homeowner chose {$name}, who has nothing in stock here — estimate these prices and set supplierProductId 0."
                    : "[{$planCategory}] the homeowner chose {$name} — use ONLY these listings for this category:";
                $lines = $rows->map(fn (SupplierProduct $p) => "{$p->id} | {$p->name} | {$p->unit} | ₱{$p->price}");
            } else {
                $rows = $inCategory->unique(fn (SupplierProduct $p) => mb_strtolower(trim($p->name)))->take(self::AUTO_ROWS);
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

    private function supplierName(SupplierProduct $product): string
    {
        return $product->supplier->business_name ?: $product->supplier->name;
    }
}
