<?php

namespace App\Services;

use App\Models\Project;
use App\Models\SupplierProduct;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

/** Completed-project participation is an explicit category choice, not an order or price citation. */
class SelectedSupplierHistoryService
{
    private function projects(User $supplier): Builder
    {
        abort_unless($supplier->role === 'supplier', 403);

        return Project::query()->where('status', 'completed')
            ->whereHas('user', fn (Builder $query) => $query->where('role', 'homeowner'))
            ->where(function (Builder $query) use ($supplier) {
                foreach (array_keys(SupplierProduct::PLAN_CATEGORIES) as $category) {
                    $query->orWhereIn('approved_plan->supplierSelections->'.$category, [$supplier->id, (string) $supplier->id]);
                }
            })->with('user:id,name')->orderByDesc('completion_confirmed_at')->orderByDesc('id');
    }

    public function listFor(User $supplier): Collection
    {
        $projects = $this->projects($supplier)->get();
        $sources = $this->sources($projects);

        return $projects->filter(fn (Project $project) => $this->categories($project, $supplier) !== [])
            ->map(fn (Project $project) => $this->present($project, $supplier, $sources, false))->values();
    }

    public function detailsFor(User $supplier, int $projectId): array
    {
        $project = $this->projects($supplier)->findOrFail($projectId);
        abort_if($this->categories($project, $supplier) === [], 404);

        return $this->present($project, $supplier, $this->sources(collect([$project])), true);
    }

    private function supplierId(mixed $value): ?int
    {
        if (! is_int($value) && ! is_string($value)) {
            return null;
        }
        $id = filter_var($value, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);

        return $id === false ? null : $id;
    }

    private function categories(Project $project, User $supplier): array
    {
        $selections = $project->approved_plan['supplierSelections'] ?? [];

        return array_values(array_filter(array_keys(SupplierProduct::PLAN_CATEGORIES),
            fn (string $category) => is_array($selections) && $this->supplierId($selections[$category] ?? null) === $supplier->id));
    }

    private function materials(Project $project): array
    {
        $saved = $project->approved_plan['materials'] ?? $project->ai_materials ?? [];

        return is_array($saved) ? array_values($saved) : [];
    }

    /** Ownership only: never read today's inventory prices, stock or activation to rewrite history. */
    private function sources(Collection $projects): Collection
    {
        $ids = $projects->flatMap(fn (Project $project) => $this->materials($project))
            ->filter(fn ($line) => is_array($line))->pluck('supplierProductId')->filter()->unique();

        return $ids->isEmpty() ? collect() : SupplierProduct::whereIn('id', $ids)->get(['id', 'supplier_id'])->keyBy('id');
    }

    private function present(Project $project, User $supplier, Collection $sources, bool $details): array
    {
        $categories = $this->categories($project, $supplier);
        $unverified = 0;
        $items = collect($this->materials($project))->map(function ($line, int $index) use ($categories, $supplier, $sources, &$unverified) {
            if (! is_array($line)) {
                return null;
            }
            $category = $line['category'] ?? null;
            $selectedCategory = in_array($category, array_keys(SupplierProduct::PLAN_CATEGORIES), true)
                ? $category : (is_string($category) ? SupplierProduct::planCategoryFor($category) : null);
            if (! in_array($selectedCategory, $categories, true)) {
                return null;
            }
            $productId = $this->supplierId($line['supplierProductId'] ?? null);
            // Prefer an immutable saved source ID. Legacy records can still resolve an existing
            // product's owner, but a name alone is never evidence of selection or ownership.
            $sourceId = $this->supplierId($line['supplierId'] ?? null) ?? $sources->get($productId)?->supplier_id;
            if ($productId !== null && $sourceId === null) {
                // A deleted legacy listing with no owner snapshot cannot prove whose quote
                // this was. Keep the project association, but never disclose an unverified quote.
                $unverified++;

                return null;
            }
            if ($sourceId !== null && $sourceId !== $supplier->id) {
                return null; // Do not expose a different supplier's quoted line, even in a selected category.
            }
            $number = fn ($value) => is_numeric($value) && is_finite((float) $value) && (float) $value >= 0 ? (float) $value : null;
            $quantity = $number($line['qty'] ?? null);
            $price = $number($line['unitPrice'] ?? null);

            return [
                'id' => 'estimate-'.$index, 'name' => (string) ($line['material'] ?? 'Unnamed saved material'),
                'category' => $category, 'selectedCategory' => $selectedCategory,
                'quantity' => $quantity, 'unit' => (string) ($line['unit'] ?? ''), 'unitPrice' => $price,
                'lineTotal' => $quantity === null || $price === null ? null : $quantity * $price,
                'priceSource' => $sourceId !== null ? 'supplier_listing' : 'saved_estimate',
                'sourceSupplierId' => $sourceId, 'supplierProductId' => $productId,
            ];
        })->filter()->values();
        $unknown = $items->whereNull('lineTotal')->count();
        $summary = [
            'id' => $project->id, 'title' => trim($project->title ?? '') ?: "Project #{$project->id}",
            'homeownerName' => $project->user->name, 'completedAt' => $project->completion_confirmed_at?->toIso8601String(),
            'associationType' => 'selected_estimate', 'selectedCategories' => $categories,
            'lineCount' => $items->count(), 'totalAmount' => $items->isEmpty() || $unknown || $unverified ? null : $items->sum('lineTotal'),
            'unverifiedSourceCount' => $unverified,
            'knownSubtotal' => $items->sum('lineTotal'), 'missingPriceCount' => $items->whereNull('unitPrice')->count(),
        ];
        if (! $details) {
            return $summary;
        }
        $floors = $project->approved_plan['floors'] ?? null;

        return $summary + ['projectType' => is_numeric($floors) && $floors > 0 ? ((int) $floors).'-storey house' : null,
            'location' => $project->location, 'items' => $items];
    }
}
