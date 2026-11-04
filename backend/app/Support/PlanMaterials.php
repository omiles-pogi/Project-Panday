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
     * from, else the same material name, else the line it is worded most like (the AI rarely writes a
     * listing's name letter for letter). Null means the item isn't in the plan.
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
        if ($name === '') {
            return null;
        }

        $exact = $lines->first(fn (array $l) => self::normalize($l['material']) === $name);
        if ($exact) {
            return $exact;
        }

        $best = null;
        $bestScore = 0.0;
        foreach ($lines as $line) {
            $score = self::similarity($line['material'], $materialName);
            if ($score > $bestScore) {
                [$best, $bestScore] = [$line, $score];
            }
        }

        return $best;
    }

    /** Below this two names are different materials, not the same one worded differently. */
    private const SIMILAR_MIN = 0.5;

    /**
     * The words that tell materials apart: lower-cased, a size kept whole ("40 kg" is "40kg"), plurals folded,
     * filler dropped.
     *
     * @return list<string>
     */
    public static function words(string $name): array
    {
        $name = preg_replace('/(\d)\s+([a-z])/u', '$1$2', mb_strtolower($name)) ?? '';
        $words = preg_split('/[^\p{L}\p{N}]+/u', $name, -1, PREG_SPLIT_NO_EMPTY) ?: [];
        $words = array_map(fn (string $w) => mb_strlen($w) > 3 && str_ends_with($w, 's') ? mb_substr($w, 0, -1) : $w, $words);

        return array_values(array_unique(array_diff($words, ['and', 'the', 'for', 'with', 'of', 'per'])));
    }

    /**
     * How alike two material names are, 0–1, where 0 means "not the same material". Every size or grade in
     * `$wanted` must appear in `$candidate` (10mm rebar is not 12mm rebar) and they must share a real word, not
     * just a number; past that it is the share of words they have in common.
     */
    public static function similarity(string $wanted, string $candidate): float
    {
        $a = self::words($wanted);
        $b = self::words($candidate);
        if ($a === [] || $b === []) {
            return 0.0;
        }

        foreach ($a as $word) {
            if (preg_match('/\d/', $word) && ! in_array($word, $b, true)) {
                return 0.0;
            }
        }

        $shared = array_intersect($a, $b);
        if (array_filter($shared, fn (string $w) => ! preg_match('/\d/', $w)) === []) {
            return 0.0;
        }

        $score = 2 * count($shared) / (count($a) + count($b));

        return $score >= self::SIMILAR_MIN ? $score : 0.0;
    }

    /** The key two requested items share when they are the same plan material (so quantities can be added up). */
    public static function itemKey(?int $listingId, string $materialName): string
    {
        return $listingId ? "listing:{$listingId}" : 'name:'.self::normalize($materialName);
    }
}
