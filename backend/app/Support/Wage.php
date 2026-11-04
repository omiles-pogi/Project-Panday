<?php

namespace App\Support;

use Illuminate\Database\Eloquent\Relations\Pivot;

/** A team member's pay on one project — a day rate × days, or a fixed fee — stored on their project link. */
final class Wage
{
    public const PER_DAY = 'per_day';

    public const FIXED = 'fixed';

    public const UNITS = [self::PER_DAY, self::FIXED];

    /** The pivot columns that hold a wage; both team tables share them. */
    public const PIVOT_COLUMNS = ['wage_amount', 'wage_unit', 'wage_days', 'wage_auto'];

    /** What the wage comes to: the fixed fee, or the day rate × the days agreed. */
    public static function total(int $amount, string $unit, ?int $days): int
    {
        return $unit === self::FIXED ? $amount : $amount * ($days ?? 0);
    }

    /**
     * @return array{amount: int, unit: string, days: int|null, total: int, auto: bool}|null null while no wage is set
     */
    public static function fromPivot(?Pivot $pivot): ?array
    {
        if ($pivot === null || $pivot->wage_amount === null) {
            return null;
        }

        $unit = (string) $pivot->wage_unit;
        $days = $unit === self::PER_DAY ? $pivot->wage_days : null;

        return [
            'amount' => (int) $pivot->wage_amount,
            'unit' => $unit,
            'days' => $days === null ? null : (int) $days,
            'total' => self::total((int) $pivot->wage_amount, $unit, $days === null ? null : (int) $days),
            // Worked out by the app rather than agreed by a person — so the screens can say so.
            'auto' => (bool) $pivot->wage_auto,
        ];
    }
}
