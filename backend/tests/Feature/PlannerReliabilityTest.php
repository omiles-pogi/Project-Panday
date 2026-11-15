<?php

namespace Tests\Feature;

use App\Exceptions\ConstructionPlanGenerationException;
use App\Models\User;
use App\Services\ConstructionPlanService;
use GuzzleHttp\Psr7\FnStream;
use GuzzleHttp\Psr7\Utils;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class PlannerReliabilityTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['services.groq.key' => 'test-key', 'services.groq.model' => 'openai/gpt-oss-120b']);
        Http::preventStrayRequests();
    }

    private function generate(): array
    {
        return app(ConstructionPlanService::class)->generate([['role' => 'user', 'content' => 'PRIVATE_TEST_PROMPT']], false, fn () => null);
    }

    public function test_a_final_provider_line_without_a_newline_is_consumed(): void
    {
        $stream = 'data: '.json_encode(['choices' => [['delta' => ['content' => 'Hello']]]])."\n\ndata: [DONE]";
        Http::fake(['api.groq.com/*' => Http::response($stream, 200)]);
        $this->assertSame(['chatReply' => true, 'message' => 'Hello'], $this->generate());
    }

    public function test_a_truncated_chat_stream_is_not_saved_as_a_completed_reply_or_retried_automatically(): void
    {
        $stream = 'data: '.json_encode(['choices' => [['delta' => ['content' => 'Partial text']]]])."\n\n";
        Http::fake(['api.groq.com/*' => Http::response($stream, 200)]);
        try {
            $this->generate();
            $this->fail('Truncated provider response must fail.');
        } catch (ConstructionPlanGenerationException $error) {
            $this->assertSame('provider_stream', $error->failureKind());
        }
        Http::assertSentCount(1);
    }

    public function test_native_body_read_errors_become_safe_retryable_stream_failures(): void
    {
        $body = FnStream::decorate(Utils::streamFor('unread'), [
            'eof' => fn () => false,
            'read' => fn () => throw new \RuntimeException('PRIVATE_TEST_PROVIDER_DETAILS'),
        ]);
        Http::fake(['api.groq.com/*' => Http::response($body, 200)]);
        try {
            $this->generate();
            $this->fail('Stream read failure must surface.');
        } catch (ConstructionPlanGenerationException $error) {
            $this->assertSame('provider_stream', $error->failureKind());
            $this->assertStringNotContainsString('PRIVATE_TEST', $error->getMessage());
        }
    }

    public static function connectionFailures(): array
    {
        return [['cURL error 28: timed out', 'provider_timeout'], ['connection refused PRIVATE_TEST', 'provider_connection']];
    }

    #[DataProvider('connectionFailures')]
    public function test_connection_failures_are_distinct_and_sanitized(string $message, string $kind): void
    {
        Http::fake(['api.groq.com/*' => fn () => throw new ConnectionException($message)]);
        try {
            $this->generate();
            $this->fail('Expected connection failure.');
        } catch (ConstructionPlanGenerationException $error) {
            $this->assertSame($kind, $error->failureKind());
            $this->assertStringNotContainsString('PRIVATE_TEST', $error->getMessage());
        }
    }

    public function test_provider_configuration_failure_is_sanitized(): void
    {
        Http::fake(['api.groq.com/*' => Http::response(['error' => ['message' => 'PRIVATE_TEST_PROVIDER_SECRET']], 401)]);
        try {
            $this->generate();
            $this->fail('Expected provider configuration failure.');
        } catch (ConstructionPlanGenerationException $error) {
            $this->assertSame('provider_configuration', $error->failureKind());
            $this->assertStringNotContainsString('PRIVATE_TEST', $error->getMessage());
        }
    }

    public function test_controller_turns_unexpected_errors_after_stream_headers_into_safe_error_events(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'homeowner', 'approval_status' => 'approved']));
        $this->mock(ConstructionPlanService::class)->shouldReceive('generate')->once()->andThrow(new \RuntimeException('PRIVATE_TEST_STACK'));
        Log::spy();
        $content = $this->postJson('/api/ai/plan', ['messages' => [['role' => 'user', 'content' => 'PRIVATE_TEST_PROMPT']]], ['X-PandAI-Request-ID' => 'panday-safe-request'])
            ->assertOk()->streamedContent();
        $events = array_map(fn ($line) => json_decode($line, true), explode("\n", trim($content)));
        $this->assertSame('started', $events[0]['type']);
        $this->assertSame('backend_error', $events[1]['code']);
        $this->assertSame('panday-safe-request', $events[1]['requestId']);
        $this->assertStringNotContainsString('PRIVATE_TEST', $content);
        Log::shouldHaveReceived('error')->once()->with('PandAI request failed.', [
            'request_id' => 'panday-safe-request', 'category' => 'backend_error', 'exception_type' => \RuntimeException::class,
        ]);
    }

    public function test_provider_failure_events_preserve_the_failure_category_without_private_details(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'homeowner', 'approval_status' => 'approved']));
        Http::fake(['api.groq.com/*' => Http::response(['error' => ['message' => 'PRIVATE_TEST_PROVIDER_DETAILS']], 503)]);
        $content = $this->postJson('/api/ai/plan', ['messages' => [['role' => 'user', 'content' => 'PRIVATE_TEST_PROMPT']]])->assertOk()->streamedContent();
        $events = array_map(fn ($line) => json_decode($line, true), explode("\n", trim($content)));
        $this->assertSame('error', $events[1]['type']);
        $this->assertSame('provider_response', $events[1]['code']);
        $this->assertStringNotContainsString('PRIVATE_TEST', $content);
        $this->assertDatabaseCount('projects', 0);
    }

    public function test_sse_errors_report_the_actual_upstream_status_without_logging_private_provider_prose(): void
    {
        $stream = 'data: '.json_encode(['error' => ['message' => 'PRIVATE_TEST_PROMPT_AND_CREDENTIAL', 'code' => 'PRIVATE_TEST_SECRET', 'type' => 'server_error']])."\n\n";
        Http::fake(['api.groq.com/*' => Http::response($stream, 200)]);
        try {
            $this->generate();
            $this->fail('Expected SSE failure.');
        } catch (ConstructionPlanGenerationException $error) {
            $this->assertSame('provider_stream', $error->failureKind());
            $this->assertSame(502, $error->statusCode());
            $this->assertSame(200, $error->diagnostics()['upstream_status']);
            $this->assertSame('provider_sse', $error->diagnostics()['failure_origin']);
            $this->assertSame('other', $error->diagnostics()['provider_code']);
            $this->assertStringNotContainsString('PRIVATE_TEST', json_encode($error->diagnostics()).$error->getMessage());
        }
        Http::assertSentCount(1);
    }

    public function test_known_streamed_tool_rejection_can_retry_before_any_chat_is_emitted(): void
    {
        $rejected = 'data: '.json_encode(['error' => ['code' => 'tool_use_failed', 'message' => 'PRIVATE_TEST_GENERATION']])."\n\n";
        $success = 'data: '.json_encode(['choices' => [['delta' => ['content' => 'Hello']]]])."\n\ndata: [DONE]\n";
        Http::fake(['api.groq.com/*' => Http::sequence()->push($rejected)->push($success)]);
        $this->assertSame('Hello', $this->generate()['message']);
        Http::assertSentCount(2);
    }

    public function test_a_streamed_tool_error_after_visible_text_is_never_retried_automatically(): void
    {
        $stream = 'data: '.json_encode(['choices' => [['delta' => ['content' => 'Partial']]]])."\n\ndata: ".json_encode(['error' => ['code' => 'tool_use_failed']])."\n\n";
        Http::fake(['api.groq.com/*' => Http::response($stream, 200)]);
        try {
            $this->generate();
            $this->fail('Expected interrupted reply.');
        } catch (ConstructionPlanGenerationException $error) {
            $this->assertTrue($error->diagnostics()['partial_content']);
        }
        Http::assertSentCount(1);
    }

    public function test_output_token_exhaustion_is_distinct_from_connectivity_failure_and_not_saved_as_success(): void
    {
        $stream = 'data: '.json_encode(['choices' => [['delta' => ['content' => 'Incomplete'], 'finish_reason' => 'length']]])."\n\ndata: [DONE]\n";
        Http::fake(['api.groq.com/*' => Http::response($stream, 200)]);
        try {
            $this->generate();
            $this->fail('Token-limited response must not succeed.');
        } catch (ConstructionPlanGenerationException $error) {
            $this->assertSame('provider_output_limit', $error->failureKind());
        }
        Http::assertSentCount(1);
    }

    public function test_rate_limit_errors_inside_http_200_are_not_reported_as_an_upstream_502(): void
    {
        $stream = 'data: '.json_encode(['error' => ['code' => 'rate_limit_exceeded', 'type' => 'tokens']])."\n\n";
        Http::fake(['api.groq.com/*' => Http::response($stream, 200)]);
        try {
            $this->generate();
            $this->fail('Expected rate limit.');
        } catch (ConstructionPlanGenerationException $error) {
            $this->assertSame('provider_rate_limit', $error->failureKind());
            $this->assertSame(429, $error->statusCode());
            $this->assertSame(200, $error->diagnostics()['upstream_status']);
        }
    }
}
