<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ContractorRecommendationTest extends TestCase
{
    use RefreshDatabase;

    private function contractor(array $overrides = []): User
    {
        return User::factory()->create(array_merge([
            'role' => 'contractor',
            'approval_status' => 'approved',
        ], $overrides));
    }

    private function homeowner(array $overrides = []): User
    {
        return User::factory()->create(array_merge([
            'role' => 'homeowner',
            'approval_status' => 'approved',
        ], $overrides));
    }

    public function test_a_contractor_can_create_and_update_their_profile(): void
    {
        $contractor = $this->contractor();
        Sanctum::actingAs($contractor);

        $response = $this->putJson('/api/contractor-profile', [
            'company_name' => 'RCG Construction',
            'specialization' => 'Residential Renovation',
            'years_experience' => 10,
            'bio' => 'Full-service residential contractor.',
            'skills' => ['Project Management', 'Permitting', 'Renovation'],
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('company_name', 'RCG Construction')
            ->assertJsonPath('specialization', 'Residential Renovation')
            ->assertJsonCount(3, 'skills');

        $this->assertDatabaseHas('contractor_profiles', ['user_id' => $contractor->id, 'specialization' => 'Residential Renovation']);
        $this->assertDatabaseCount('contractor_skills', 3);
    }

    public function test_only_a_contractor_role_can_set_a_contractor_profile(): void
    {
        Sanctum::actingAs($this->homeowner());

        $this->putJson('/api/contractor-profile', [
            'specialization' => 'Residential Renovation',
            'years_experience' => 5,
            'skills' => ['Permitting'],
        ])->assertStatus(403);
    }

    public function test_search_ranks_closer_specialization_and_skill_matches_higher(): void
    {
        $residential = $this->contractor(['name' => 'Residential Contractor']);
        Sanctum::actingAs($residential);
        $this->putJson('/api/contractor-profile', [
            'specialization' => 'Residential Renovation',
            'years_experience' => 10,
            'skills' => ['Project Management', 'Permitting', 'Renovation'],
        ])->assertStatus(200);

        $commercial = $this->contractor(['name' => 'Commercial Contractor']);
        Sanctum::actingAs($commercial);
        $this->putJson('/api/contractor-profile', [
            'specialization' => 'Commercial Build',
            'years_experience' => 3,
            'skills' => ['Steel Framing'],
        ])->assertStatus(200);

        Sanctum::actingAs($this->homeowner());
        $response = $this->getJson('/api/contractors?specialization=Residential+Renovation&skills[]=Permitting&skills[]=Renovation');

        $response->assertStatus(200)->assertJsonCount(2);
        $names = collect($response->json())->pluck('name');
        $this->assertSame('Residential Contractor', $names->first());
    }

    public function test_search_excludes_contractors_without_a_profile(): void
    {
        $this->contractor();
        Sanctum::actingAs($this->homeowner());

        $this->getJson('/api/contractors')->assertStatus(200)->assertJsonCount(0);
    }

    public function test_a_homeowner_can_rate_a_contractor(): void
    {
        $contractor = $this->contractor();
        Sanctum::actingAs($this->homeowner());

        $response = $this->postJson("/api/contractors/{$contractor->id}/ratings", [
            'score' => 5,
            'comment' => 'Delivered on time.',
        ]);

        $response->assertStatus(201)->assertJsonPath('score', 5);
        $this->assertDatabaseHas('contractor_ratings', ['contractor_id' => $contractor->id, 'score' => 5]);
    }

    public function test_a_contractor_cannot_rate_themselves(): void
    {
        $contractor = $this->contractor();
        Sanctum::actingAs($contractor);

        $this->postJson("/api/contractors/{$contractor->id}/ratings", ['score' => 5])->assertStatus(422);
    }

    public function test_only_contractors_can_be_rated(): void
    {
        $target = $this->homeowner();
        Sanctum::actingAs($this->homeowner());

        $this->postJson("/api/contractors/{$target->id}/ratings", ['score' => 5])->assertStatus(422);
    }

    public function test_contractor_endpoints_require_authentication(): void
    {
        $this->getJson('/api/contractors')->assertStatus(401);
        $this->putJson('/api/contractor-profile', [])->assertStatus(401);
    }
}
