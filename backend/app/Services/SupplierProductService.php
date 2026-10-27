<?php

namespace App\Services;

use App\Models\SupplierProduct;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
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
        $product->update($data);

        return $product;
    }

    public function delete(SupplierProduct $product, User $actingUser): void
    {
        $this->authorizeOwner($product, $actingUser);
        $product->delete();
    }

    private function authorizeOwner(SupplierProduct $product, User $actingUser): void
    {
        if ($product->supplier_id !== $actingUser->id) {
            throw ValidationException::withMessages(['product_id' => 'This is not your listing.']);
        }
    }

    /**
     * A compact, prompt-ready list of real current supplier prices — the cheapest available listing
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
            ->where('available', true)
            ->orderBy('price')
            ->get(['name', 'unit', 'price'])
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
