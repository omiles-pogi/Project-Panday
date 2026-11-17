<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\User;
use App\Services\TeamRecommendationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TeamRecommendationTest extends TestCase
{
    use RefreshDatabase;

    private function owner(): User
    {
        return User::factory()->create(['role' => 'homeowner', 'approval_status' => 'approved']);
    }

    private function project(User $owner, array $phases, array $extra = []): Project
    {
        return Project::create(['user_id' => $owner->id, 'title' => 'Saved approved project', 'status' => 'active',
            'budget' => 900000, 'total_estimate' => 800000, 'timeline_value' => 6, 'timeline_unit' => 'months', 'started_at' => '2026-11-01',
            'approved_plan' => array_replace(['phases' => $phases, 'budgetBreakdown' => [
                ['category' => 'Foundation and Excavation', 'amount' => 0],
                ['category' => 'Electrical and Plumbing', 'amount' => 0],
                ['category' => 'Labor Costs', 'amount' => 10000],
                ['category' => 'Contractor and Project Management Fee', 'amount' => 5000],
            ]], $extra)]);
    }

    private function person(string $trade, array $skills, string $role = 'worker', string $approval = 'approved', ?int $rate = 500): User
    {
        $user = User::factory()->create(['role' => $role, 'approval_status' => $approval]);
        $profile = $role === 'worker'
            ? $user->workerProfile()->create(['trade' => $trade, 'years_experience' => 3, 'min_daily_wage' => $rate])
            : $user->contractorProfile()->create(['specialization' => $trade, 'years_experience' => 3]);
        $profile->skills()->createMany(array_map(fn ($skill) => ['skill' => $skill], $skills));

        return $user;
    }

    private function recommendationsFor(Project $project, User $owner): array
    {
        Http::preventStrayRequests();
        Sanctum::actingAs($owner);

        return $this->getJson("/api/projects/{$project->id}/team-overview")->assertOk()->json('recommendations');
    }

    public function test_painting_uses_actual_activity_evidence_not_zero_budget_categories_ratings_or_generic_sorting(): void
    {
        $owner = $this->owner();
        $project = $this->project($owner, [['name' => 'Room repainting', 'durationWeeks' => 2, 'tasks' => ['Surface preparation', 'Skim coating', 'Paint walls; no electrical work']]]);
        $full = $this->person('Painter', ['Painting', 'Surface preparation', 'Skim coating']);
        $partial = $this->person('Painter', []);
        $unrelated = $this->person('Electrician', ['Electrical']);
        $unrelated->ratingsReceived()->create(['rater_id' => $owner->id, 'score' => 5]);
        $this->person('Painter', ['Painting'], approval: 'pending');
        $this->person('Painter', ['Painting'], approval: 'rejected');
        $before = $project->fresh()->getRawOriginal();
        $result = $this->recommendationsFor($project, $owner);
        $this->assertSame([$full->id, $partial->id], array_column($result['workers'], 'id'));
        $this->assertTrue($result['workers'][0]['bestMatch']);
        $this->assertFalse($result['workers'][1]['bestMatch']);
        $this->assertSame(['Painting', 'Surface preparation', 'Skim coating'], $result['workers'][0]['matchedSkills']);
        $this->assertStringContainsString('Room repainting', $result['workers'][0]['reason']);
        $this->assertSame(13, $result['workers'][0]['estimatedDays']);
        $this->assertSame(6500, $result['workers'][0]['estimatedWage']);
        $this->assertTrue($result['workers'][0]['budgetFit']);
        $this->assertNull($result['workers'][0]['averageRating']);
        $this->assertSame('Availability not verified', $result['workers'][0]['availability']);
        $this->assertArrayNotHasKey('email', $result['workers'][0]);
        $this->assertArrayNotHasKey('score', $result['workers'][0]);
        $this->assertSame($before, $project->fresh()->getRawOriginal());
        $this->assertDatabaseCount('project_worker_requests', 0);
    }

    public function test_bathroom_and_house_scopes_have_different_trade_candidates_and_phase_specific_days(): void
    {
        $owner = $this->owner();
        $plumber = $this->person('Plumber', ['Plumbing']);
        $tiler = $this->person('Tile setter', ['Tiling', 'Waterproofing']);
        $roofer = $this->person('Roofer', ['Roofing']);
        $mason = $this->person('Mason', ['Foundation', 'Masonry']);
        $bathroom = $this->project($owner, [
            ['name' => 'Plumbing installation', 'durationWeeks' => 1],
            ['name' => 'Waterproofing and tile installation', 'durationWeeks' => 2],
        ]);
        $house = $this->project($owner, [
            ['name' => 'Foundation and masonry', 'durationWeeks' => 3],
            ['name' => 'Roofing', 'durationWeeks' => 2],
            ['name' => 'Electrical and plumbing', 'durationWeeks' => 1],
        ]);
        $bath = $this->recommendationsFor($bathroom, $owner);
        $this->assertEqualsCanonicalizing([$plumber->id, $tiler->id], array_column($bath['workers'], 'id'));
        $byId = array_column($bath['workers'], null, 'id');
        $this->assertSame(7, $byId[$plumber->id]['estimatedDays']);
        $this->assertSame(13, $byId[$tiler->id]['estimatedDays']);
        $home = $this->recommendationsFor($house, $owner);
        $this->assertEqualsCanonicalizing([$plumber->id, $roofer->id, $mason->id], array_column($home['workers'], 'id'));
        $this->assertSame($bath, $this->recommendationsFor($bathroom, $owner));
    }

    public function test_missing_durations_rates_ratings_and_labor_allowance_remain_unknown_and_ties_have_no_best_badge(): void
    {
        $owner = $this->owner();
        $this->person('Painter', [], rate: null);
        $this->person('Painter', [], rate: 900);
        $project = $this->project($owner, [['name' => 'Painting']], ['budgetBreakdown' => [['category' => 'Finishing Works', 'amount' => 80000]]]);
        $result = $this->recommendationsFor($project, $owner);
        foreach ($result['workers'] as $worker) {
            $this->assertNull($worker['estimatedWage']);
            $this->assertNull($worker['estimatedDays']);
            $this->assertNull($worker['budgetFit']);
            $this->assertFalse($worker['bestMatch']);
        }
        $this->assertNull($result['laborBudget']);
    }

    public function test_recorded_schedule_overlap_is_honest_and_assigned_people_are_excluded_without_changing_assignments(): void
    {
        $owner = $this->owner();
        $busy = $this->person('Painter', []);
        $joined = $this->person('Painter', []);
        $project = $this->project($owner, [['name' => 'Painting', 'durationWeeks' => 2]]);
        $project->phases()->create(['name' => 'Painting', 'sort_order' => 0, 'weight_pct' => 100, 'progress_pct' => 0, 'planned_start' => '2026-11-01', 'planned_end' => '2026-11-14']);
        $other = $this->project($owner, []);
        $other->workers()->attach($busy);
        $project->workers()->attach($joined, ['wage_amount' => 2000, 'wage_unit' => 'fixed']);
        $result = $this->recommendationsFor($project, $owner);
        $this->assertSame([$busy->id], array_column($result['workers'], 'id'));
        $this->assertSame(1, $result['workers'][0]['scheduleOverlapCount']);
        $this->assertStringContainsString('overlap', $result['workers'][0]['availability']);
        $this->assertSame(8000, $result['remainingLaborBudget']);
        $this->assertSame(1, $project->workers()->count());
        $this->assertSame(1, $other->workers()->count());
    }

    public function test_contractors_are_matched_separately_from_workers_without_fabricating_contractor_daily_rates(): void
    {
        $owner = $this->owner();
        $worker = $this->person('Painter', []);
        $contractor = $this->person('Painting renovation', ['Surface preparation'], 'contractor');
        $this->person('Roofing', [], 'contractor');
        $project = $this->project($owner, [['name' => 'Painting and surface preparation', 'durationWeeks' => 1]]);
        $result = $this->recommendationsFor($project, $owner);
        $this->assertSame([$worker->id], array_column($result['workers'], 'id'));
        $this->assertSame([$contractor->id], array_column($result['contractors'], 'id'));
        $this->assertNull($result['contractors'][0]['estimatedWage']);
        $this->assertSame(5000, $result['contractorBudget']);
    }

    public function test_owner_role_completed_draft_and_provider_failure_safety(): void
    {
        $owner = $this->owner();
        $project = $this->project($owner, [['name' => 'Painting']]);
        $this->person('Painter', []);
        $this->getJson("/api/projects/{$project->id}/team-overview")->assertUnauthorized();
        Sanctum::actingAs($this->owner());
        $this->getJson("/api/projects/{$project->id}/team-overview")->assertNotFound();
        Sanctum::actingAs($this->person('Painter', []));
        $this->getJson("/api/projects/{$project->id}/team-overview")->assertForbidden();
        Http::fake(fn () => Http::response([], 502));
        $this->assertCount(2, $this->recommendationsFor($project, $owner)['workers']);
        Http::assertNothingSent();
        $project->update(['status' => 'not_started']);
        $this->assertFalse($this->recommendationsFor($project, $owner)['planApproved']);
        $project->update(['status' => 'completed', 'completion_confirmed_at' => now()]);
        $this->getJson("/api/projects/{$project->id}/team-overview")->assertNotFound();
        $this->assertFalse(app(TeamRecommendationService::class)->forProject($project->fresh(), $owner)['planApproved']);
    }

    public function test_matching_failure_does_not_break_existing_team_or_expose_diagnostics(): void
    {
        $owner = $this->owner();
        $project = $this->project($owner, [['name' => 'Painting']]);
        $worker = $this->person('Painter', []);
        $project->workers()->attach($worker);
        $this->mock(TeamRecommendationService::class, fn ($mock) => $mock->shouldReceive('forProject')->once()->andThrow(new \RuntimeException('Private diagnostic')));
        Sanctum::actingAs($owner);
        $response = $this->getJson("/api/projects/{$project->id}/team-overview")->assertOk()
            ->assertJsonPath('team.0.id', $worker->id)->assertJsonPath('recommendations', null);
        $this->assertStringNotContainsString('Private diagnostic', $response->getContent());
    }

    public function test_contractor_project_type_compatibility_uses_approved_scope_not_an_unapproved_project_rename(): void
    {
        $owner = $this->owner();
        $residential = $this->person('Residential construction', [], 'contractor');
        $renovation = $this->person('Renovations', [], 'contractor');
        $this->person('Roofing renovations', ['Roofing'], 'contractor');
        $house = $this->project($owner, [['name' => 'Foundation', 'durationWeeks' => 3]], ['projectTitle' => 'Two-storey house construction']);
        $room = $this->project($owner, [['name' => 'Painting', 'durationWeeks' => 1]], ['projectTitle' => 'Room painting renovation']);
        $room->update(['title' => 'New house construction']);
        $this->assertSame([$residential->id], array_column($this->recommendationsFor($house, $owner)['contractors'], 'id'));
        $this->assertSame([$renovation->id], array_column($this->recommendationsFor($room, $owner)['contractors'], 'id'));
    }
}
