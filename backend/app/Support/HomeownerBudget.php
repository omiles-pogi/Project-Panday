<?php

namespace App\Support;

/**
 * Reads the homeowner's own budget straight from what they typed, so the plan's "budget" is
 * never the AI's guess, a misread, or its estimate echoed back.
 *
 * Understands Philippine shorthand: "₱2.5M", "2.5 million", "2.5 mil", "3 milyon", "800k",
 * "1,800,000 pesos", "PHP 3,000,000". An amount counts as the budget when it sits close to a
 * budget word ("budget", "pondo", "afford", "up to"…); the homeowner's LATEST such mention wins,
 * so "make the budget 3M" later in the chat updates it.
 */
final class HomeownerBudget
{
    private const AMOUNT = '/(?<cur>₱|php\.?|p(?=\s?\d))?\s*(?<num>\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s*(?<mag>million|milyon|mil|m|thousand|libo|k)?(?![\p{L}\d²])(?:\s*(?<cur2>pesos?|php))?/iu';

    private const KEYWORDS = '/\b(budget|badyet|pondo|afford|allot(?:ted)?|allocate[ds]?|spend|gastusin|max(?:imum)?|limit|up to|hanggang|i have|we have|meron (?:akong|kaming))\b/iu';

    /** Amounts must sit within this many characters of a budget word to count as the budget. */
    private const MAX_DISTANCE = 40;

    /** Plain numbers below this, with no ₱ / "pesos" / M / k, are areas, counts or years — not money. */
    private const MIN_BARE_AMOUNT = 50000;

    /**
     * @param  array<int, array{role: string, content: string}>  $messages
     */
    public static function fromMessages(array $messages): ?int
    {
        $budget = null;
        foreach ($messages as $message) {
            if (($message['role'] ?? null) !== 'user') {
                continue;
            }
            $found = self::fromText((string) $message['content']);
            if ($found !== null) {
                $budget = $found;
            }
        }

        return $budget;
    }

    /** True when the homeowner typed this amount anywhere (±1%), even without a budget word. */
    public static function wasMentioned(array $messages, float $amount): bool
    {
        if ($amount <= 0) {
            return false;
        }
        foreach ($messages as $message) {
            if (($message['role'] ?? null) !== 'user') {
                continue;
            }
            foreach (self::amounts((string) $message['content']) as $a) {
                if (abs($a['value'] - $amount) <= $amount * 0.01) {
                    return true;
                }
            }
        }

        return false;
    }

    /** The amount closest to a budget word in one message, or null. */
    public static function fromText(string $text): ?int
    {
        preg_match_all(self::KEYWORDS, $text, $keywordMatches, PREG_OFFSET_CAPTURE);
        $keywords = array_map(fn ($m) => [$m[1], $m[1] + strlen($m[0])], $keywordMatches[0]);
        if ($keywords === []) {
            return null;
        }

        $best = null;
        foreach (self::amounts($text) as $a) {
            $distance = min(array_map(
                fn ($k) => $a['end'] <= $k[0] ? $k[0] - $a['end'] : max(0, $a['start'] - $k[1]),
                $keywords,
            ));
            // Ties go to the later amount (e.g. "budget was 2M, now 3M").
            if ($distance <= self::MAX_DISTANCE && ($best === null || $distance <= $best['distance'])) {
                $best = ['value' => $a['value'], 'distance' => $distance];
            }
        }

        return $best ? (int) round($best['value']) : null;
    }

    /**
     * @return array<int, array{value: float, start: int, end: int}>
     */
    private static function amounts(string $text): array
    {
        preg_match_all(self::AMOUNT, $text, $matches, PREG_SET_ORDER | PREG_OFFSET_CAPTURE);

        $amounts = [];
        foreach ($matches as $m) {
            $number = (float) str_replace(',', '', $m['num'][0]);
            $magnitude = strtolower($m['mag'][0] ?? '');
            $hasCurrency = ($m['cur'][0] ?? '') !== '' || ($m['cur2'][0] ?? '') !== '';

            $value = match (true) {
                in_array($magnitude, ['million', 'milyon', 'mil', 'm'], true) => $number * 1_000_000,
                in_array($magnitude, ['thousand', 'libo', 'k'], true) => $number * 1_000,
                default => $number,
            };

            if ($value <= 0 || (! $hasCurrency && $magnitude === '' && $value < self::MIN_BARE_AMOUNT)) {
                continue;
            }

            $start = $m[0][1];
            $amounts[] = ['value' => $value, 'start' => $start, 'end' => $start + strlen(rtrim($m[0][0]))];
        }

        return $amounts;
    }
}
