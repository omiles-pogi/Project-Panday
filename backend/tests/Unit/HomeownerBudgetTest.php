<?php

namespace Tests\Unit;

use App\Support\HomeownerBudget;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class HomeownerBudgetTest extends TestCase
{
    /**
     * @return array<string, array{0: string, 1: ?int}>
     */
    public static function phrases(): array
    {
        return [
            'peso sign + M' => ['3-bedroom house in Quezon City, 120 sqm, ₱2.5M budget, modern design.', 2_500_000],
            'million word' => ['My budget is 2.5 million pesos for a 2 storey house', 2_500_000],
            'mil shorthand' => ['budget 3 mil lang po', 3_000_000],
            'filipino milyon' => ['ang pondo ko ay 1.8 milyon', 1_800_000],
            'k suffix' => ['bathroom renovation, budget around 350k', 350_000],
            'commas' => ['We can afford up to 1,800,000 for this.', 1_800_000],
            'php prefix' => ['Budget: PHP 4,200,000', 4_200_000],
            'budget after amount' => ['I have ₱900,000 to spend on a kitchen', 900_000],
            'closest amount wins' => ['My budget is 3M and the lot already cost 1M', 3_000_000],
            'area is not money' => ['budget is 2M for a 120 sqm bungalow with 3 bedrooms', 2_000_000],
            'area only' => ['A 120 sqm bungalow with 3 bedrooms in Cebu', null],
            'm2 not money' => ['budget? not sure yet, lot is 150m2', null],
            'no budget word' => ['A ₱2M house in Davao', null],
            'year not money' => ['I want to finish by 2027, budget not decided', null],
        ];
    }

    #[DataProvider('phrases')]
    public function test_it_reads_the_homeowners_budget(string $text, ?int $expected): void
    {
        $this->assertSame($expected, HomeownerBudget::fromText($text));
    }

    public function test_the_latest_user_mention_wins_and_assistant_messages_are_ignored(): void
    {
        $messages = [
            ['role' => 'user', 'content' => '2 bedroom house, budget 2M'],
            ['role' => 'assistant', 'content' => 'Your budget of ₱9,999,999 is noted.'],
            ['role' => 'user', 'content' => 'Actually increase my budget to 2.8 million'],
            ['role' => 'user', 'content' => 'Can you add a garage?'],
        ];

        $this->assertSame(2_800_000, HomeownerBudget::fromMessages($messages));
    }

    public function test_no_budget_when_the_homeowner_never_gave_one(): void
    {
        $this->assertNull(HomeownerBudget::fromMessages([['role' => 'user', 'content' => '3 bedroom modern house, 150 sqm']]));
    }

    public function test_was_mentioned_checks_user_amounts_only(): void
    {
        $messages = [
            ['role' => 'user', 'content' => 'A ₱2M house in Davao'],
            ['role' => 'assistant', 'content' => 'Estimate ₱3,100,000'],
        ];

        $this->assertTrue(HomeownerBudget::wasMentioned($messages, 2_000_000));
        $this->assertFalse(HomeownerBudget::wasMentioned($messages, 3_100_000));
    }
}
