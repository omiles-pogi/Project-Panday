<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SavePlanBlankTextTest extends TestCase
{
    use RefreshDatabase;

    /** @return array<string, mixed> */
    private function plan(array $overrides = []): array
    {
        return array_merge([
            'projectTitle' => 'My House', 'location' => '', 'budget' => 0, 'totalEstimate' => 600000, 'timelineValue' => 6, 'timelineUnit' => 'months',
            'areaSqm' => 80, 'floors' => 1, 'bedrooms' => 2, 'bathrooms' => 1, 'garageCars' => 0,
            'designStyle' => 'Modern', 'exteriorConcept' => 'Simple facade', 'interiorConcept' => 'Open kitchen',
            'phases' => [['name' => 'Foundation', 'percentComplete' => 100, 'tasks' => ['Pour slab']]],
        ], $overrides);
    }

    public function test_a_plan_with_a_blank_design_style_or_concepts_still_saves(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'homeowner', 'approval_status' => 'approved']));

        // An empty string reaches validation as null; the descriptive fields are optional, so that's fine.
        $this->postJson('/api/projects', $this->plan(['designStyle' => '', 'exteriorConcept' => '', 'interiorConcept' => '']))
            ->assertCreated();
        $this->postJson('/api/projects', $this->plan(['designStyle' => null, 'exteriorConcept' => null, 'interiorConcept' => null]))
            ->assertCreated();
    }

    public function test_a_design_style_must_still_be_text_when_given(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'homeowner', 'approval_status' => 'approved']));

        $this->postJson('/api/projects', $this->plan(['designStyle' => ['modern']]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('designStyle');
    }

    public function test_the_same_blank_text_saves_into_a_not_started_project_too(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'homeowner', 'approval_status' => 'approved']));
        $draft = $this->postJson('/api/projects/draft')->json('id');

        $this->postJson("/api/projects/{$draft}/plan", $this->plan(['designStyle' => '']))->assertOk();
    }
}
