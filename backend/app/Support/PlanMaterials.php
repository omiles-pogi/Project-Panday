<?php

namespace App\Support;

use App\Models\Project;
use Illuminate\Support\Collection;

/**
 * The materials of a project's approved AI plan (`projects.ai_materials`) as comparable lines: what the
 * AI estimated, what the contractor's review settled on, and which phase needs it. Kept free of other
 * services so the planning, request and approval code can all read the plan the same way.
 */
final class PlanMaterials
{
    public static function normalize(string $name): string
    {
        return mb_strtolower(preg_replace('/\s+/', ' ', trim($name)) ?? '');
    }

    /**
     * @return Collection<int, array{index: int, material: string, supplierProductId: int, phase: string, unit: string, category: ?string, estimatedUnitPrice: int, aiQuantity: int, contractorQuantity: int, wastePct: int, plannedQuantity: int, reviewed: bool}>
     */
    public static function lines(Project $project): Collection
    {
        return collect($project->ai_materials ?? [])->values()->map(function (array $m, int $index) {
            $aiQuantity = max(1, (int) ceil((float) ($m['qty'] ?? 1)));
            $reviewed = isset($m['reviewedQty']);

            return [
                'index' => $index,
                'material' => (string) ($m['material'] ?? ''),
                'supplierProductId' => (int) ($m['supplierProductId'] ?? 0),
                'phase' => (string) ($m['phase'] ?? ''),
                'unit' => (string) ($m['unit'] ?? 'piece'),
                'category' => $m['category'] ?? null,
                'estimatedUnitPrice' => (int) round((float) ($m['unitPrice'] ?? 0)),
                'aiQuantity' => $aiQuantity,
                // What the contractor said they need before the waste allowance (the AI's figure until they review).
                'contractorQuantity' => max(1, (int) ($m['contractorQty'] ?? $aiQuantity)),
                'wastePct' => (int) ($m['wastePct'] ?? 0),
                // Until the contractor reviews it, the plan's quantity is the AI's own.
                'plannedQuantity' => $reviewed ? max(1, (int) $m['reviewedQty']) : $aiQuantity,
                'reviewed' => $reviewed,
            ];
        });
    }

    /**
     * The plan line a requested item corresponds to: the same supplier listing the plan was priced
     * from, else the same material name. Null means the item isn't in the plan.
     *
     * @return array<string, mixed>|null
     */
    public static function match(Project $project, ?int $listingId, string $materialName): ?array
    {
        $lines = self::lines($project);

        if ($listingId) {
            $byListing = $lines->first(fn (array $l) => $l['supplierProductId'] === $listingId);
            if ($byListing) {
                return $byListing;
            }
        }

        $name = self::normalize($materialName);

        return $name === '' ? null : $lines->first(fn (array $l) => self::normalize($l['material']) === $name);
    }

    /** The key two requested items share when they are the same plan material (so quantities can be added up). */
    public static function itemKey(?int $listingId, string $materialName): string
    {
        return $listingId ? "listing:{$listingId}" : 'name:'.self::normalize($materialName);
    }
}
