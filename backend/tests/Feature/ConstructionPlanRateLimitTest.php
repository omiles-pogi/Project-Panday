<?php

namespace Tests\Feature;

use App\Exceptions\ConstructionPlanGenerationException;
use App\Services\ConstructionPlanService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Sleep;
use Tests\TestCase;

class ConstructionPlanRateLimitTest extends TestCase
{
    use RefreshDatabase;

    private const GROQ = 'api.groq.com/*';

    protected function setUp(): void
    {
        parent::setUp();
        config(['services.groq.key' => 'test-key', 'services.groq.model' => 'openai/gpt-oss-120b']);
        Sleep::fake();
    }

    private function chatStream(string $text): string
    {
        return 'data: '.json_encode(['choices' => [['delta' => ['content' => $text]]]])."\n\ndata: [DONE]\n\n";
    }

    private function rateLimited(string $message = 'Rate limit reached on tokens per minute (TPM): Limit 8000, Used 6045, Requested 6710. Please try again in 35.6s.', ?string $retryAfter = '36'): array
    {
        return [
            'body' => ['error' => ['message' => $message, 'type' => 'tokens', 'code' => 'rate_limit_exceeded']],
            'status' => 429,
            'headers' => $retryAfter === null ? [] : ['retry-after' => $retryAfter],
        ];
    }

    private function generate(array $messages = [['role' => 'user', 'content' => 'hello']]): array
    {
        return app(ConstructionPlanService::class)->generate($messages, false, fn () => null);
    }

    public function test_a_rate_limit_is_waited_out_and_retried_instead_of_failing(): void
    {
        $limited = $this->rateLimited();
        Http::fake([self::GROQ => Http::sequence()
            ->push($limited['body'], 429, $limited['headers'])
            ->push($this->chatStream('Hi! What would you like to build?'), 200),
        ]);

        $result = $this->generate();

        $this->assertSame(['chatReply' => true, 'message' => 'Hi! What would you like to build?'], $result);
        Http::assertSentCount(2);
        // The 36s Retry-After, plus a second of slack.
        Sleep::assertSlept(fn ($duration) => (int) $duration->totalSeconds === 37, 1);
    }

    public function test_a_persistent_rate_limit_tells_the_user_how_long_to_wait(): void
    {
        $limited = $this->rateLimited();
        Http::fake([self::GROQ => Http::response($limited['body'], 429, $limited['headers'])]);

        try {
            $this->generate();
            $this->fail('Expected the rate limit to surface.');
        } catch (ConstructionPlanGenerationException $e) {
            $this->assertSame(429, $e->statusCode());
            $this->assertStringContainsString('handling a lot of requests', $e->getMessage());
            $this->assertStringContainsString('in about 36 seconds', $e->getMessage());
            $this->assertStringNotContainsString('org_', $e->getMessage());
        }
    }

    public function test_a_long_wait_is_not_slept_through(): void
    {
        $limited = $this->rateLimited('Rate limit reached on tokens per minute (TPM). Please try again in 10m0s.', '600');
        Http::fake([self::GROQ => Http::response($limited['body'], 429, $limited['headers'])]);

        try {
            $this->generate();
            $this->fail('Expected the rate limit to surface.');
        } catch (ConstructionPlanGenerationException $e) {
            $this->assertStringContainsString('in about 10 minutes', $e->getMessage());
        }

        Sleep::assertNeverSlept();
        Http::assertSentCount(1);
    }

    public function test_the_wait_is_read_from_the_message_when_there_is_no_retry_after_header(): void
    {
        $limited = $this->rateLimited('Rate limit reached on tokens per minute (TPM). Please try again in 7m12.5s.', null);
        Http::fake([self::GROQ => Http::response($limited['body'], 429)]);

        try {
            $this->generate();
            $this->fail('Expected the rate limit to surface.');
        } catch (ConstructionPlanGenerationException $e) {
            $this->assertStringContainsString('in about 8 minutes', $e->getMessage());
        }
    }

    public function test_a_daily_limit_is_reported_as_such(): void
    {
        $limited = $this->rateLimited('Rate limit reached on tokens per day (TPD): Limit 200000. Please try again in 2h5m0s.', '7500');
        Http::fake([self::GROQ => Http::response($limited['body'], 429, $limited['headers'])]);

        try {
            $this->generate();
            $this->fail('Expected the rate limit to surface.');
        } catch (ConstructionPlanGenerationException $e) {
            $this->assertStringContainsString('daily usage limit', $e->getMessage());
            $this->assertStringContainsString('in about 3 hours', $e->getMessage());
        }
    }

    public function test_a_too_large_request_gets_an_actionable_message(): void
    {
        Http::fake([self::GROQ => Http::response(['error' => ['message' => 'Request too large for model on tokens per minute (TPM): Limit 8000, Requested 9500']], 413)]);

        try {
            $this->generate();
            $this->fail('Expected a failure.');
        } catch (ConstructionPlanGenerationException $e) {
            $this->assertSame(413, $e->statusCode());
            $this->assertStringContainsString('too long', $e->getMessage());
        }
    }

    public function test_a_groq_outage_is_not_reported_as_a_busy_service(): void
    {
        Http::fake([self::GROQ => Http::response(['error' => ['message' => 'upstream exploded']], 503)]);

        try {
            $this->generate();
            $this->fail('Expected a failure.');
        } catch (ConstructionPlanGenerationException $e) {
            $this->assertStringContainsString('temporarily unavailable', $e->getMessage());
            $this->assertStringNotContainsString('upstream exploded', $e->getMessage());
        }
    }

    public function test_requests_ask_for_low_reasoning_and_a_reply_size_that_fits_the_token_limit(): void
    {
        Http::fake([self::GROQ => Http::response($this->chatStream('ok'), 200)]);

        $this->generate();

        Http::assertSent(function (Request $request) {
            $body = $request->data();

            return $body['reasoning_effort'] === 'low'
                && $body['max_completion_tokens'] >= 2200
                && $body['max_completion_tokens'] <= 4096
                // Prompt + reply must leave room under the 8000 tokens-per-minute cap.
                && strlen(json_encode([$body['messages'], $body['tools']])) / 3.8 + $body['max_completion_tokens'] < 8000;
        });
    }

    public function test_a_model_without_reasoning_support_is_not_sent_the_parameter(): void
    {
        config(['services.groq.model' => 'llama-3.3-70b-versatile']);
        Http::fake([self::GROQ => Http::response($this->chatStream('ok'), 200)]);

        $this->generate();

        Http::assertSent(fn (Request $request) => ! array_key_exists('reasoning_effort', $request->data()));
    }

    public function test_only_the_recent_conversation_is_sent(): void
    {
        Http::fake([self::GROQ => Http::response($this->chatStream('ok'), 200)]);
        $history = collect(range(1, 30))->map(fn ($i) => ['role' => $i % 2 ? 'user' : 'assistant', 'content' => "message {$i}"])->all();

        $this->generate($history);

        Http::assertSent(function (Request $request) {
            $messages = $request->data()['messages'];

            // The system prompt plus the last twelve turns, ending on the newest.
            return count($messages) === 13 && end($messages)['content'] === 'message 30';
        });
    }
}
