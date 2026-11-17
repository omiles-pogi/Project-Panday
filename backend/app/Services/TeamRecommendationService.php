<?php

namespace App\Services;

use App\Models\Project;
use App\Models\User;
use App\Support\Wage;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;

/** Explainable matching against the saved AI plan, not an LLM-generated list of people.
 * Reads only: never schedules phases, assigns people, changes wages or calls the provider.
 */
class TeamRecommendationService
{
    // Trade vocabulary, not project templates. A concept needs positive evidence in an
    // approved activity AND in a real profile. Budget categories never create trades.
    private const TERMS = [
        'Painting' => ['paint', 'painting', 'painter', 'repaint', 'repainting'],
        'Surface preparation' => ['surface preparation', 'surface prep', 'sanding', 'sand surfaces'],
        'Skim coating' => ['skim coat', 'skim coating', 'skimming'],
        'Plumbing' => ['plumb', 'plumbing', 'plumber', 'pipe installation', 'piping', 'sanitary installation'],
        'Waterproofing' => ['waterproof', 'waterproofing'],
        'Tiling' => ['tile', 'tiles', 'tiling', 'tile setter', 'tile installation'],
        'Electrical' => ['electrical', 'electrician', 'wiring', 'electrical installation'],
        'Roofing' => ['roof', 'roofing', 'roofer'],
        'Masonry' => ['mason', 'masonry', 'block laying', 'blockwork', 'brickwork', 'concrete work'],
        'Carpentry' => ['carpenter', 'carpentry', 'formwork', 'framing', 'woodwork'],
        'Excavation' => ['excavation', 'excavate', 'earthworks', 'earthwork'],
        'Foundation' => ['foundation', 'footing', 'footings'],
        'Steel work' => ['welding', 'welder', 'rebar', 'reinforcement', 'steel fabrication'],
        'Plastering' => ['plaster', 'plastering', 'plasterer', 'rendering'],
        'Demolition' => ['demolition', 'demolish', 'dismantling'],
        'Project management' => ['project management', 'construction management', 'site supervision'],
    ];

    public function __construct(private readonly WorkerService $workers, private readonly ContractorService $contractors) {}

    public function forProject(Project $project, User $owner): array
    {
        abort_unless($project->isOwnedBy($owner), 403);
        $plan = is_array($project->approved_plan) ? $project->approved_plan : [];
        $approved = in_array($project->status, ['active', Project::PENDING_CONFIRMATION], true)
            && ! $project->completion_confirmed_at && ! empty($plan);
        $base = ['projectId' => $project->id, 'projectTitle' => $project->title, 'planApproved' => $approved,
            'method' => 'approved_plan_matching', 'workers' => [], 'contractors' => [], 'requirements' => [],
            'laborBudget' => null, 'remainingLaborBudget' => null, 'contractorBudget' => null,
            'notice' => 'Matches use approved AI-plan activities and recorded profiles; availability requires confirmation.'];
        if (! $approved) {
            return array_replace($base, ['notice' => 'Approve an ongoing project plan to see project-specific recommendations.']);
        }
        $project->loadMissing(['phases', 'workers', 'contractors']);
        $requirements = $this->requirements($project, $plan);
        $labor = $this->budget($plan, 'Labor Costs');
        $committed = 0;
        $known = true;
        foreach ($project->workers as $member) {
            $wage = Wage::fromPivot($member->pivot);
            if (! $wage || ($wage['unit'] === Wage::PER_DAY && $wage['days'] === null)) {
                $known = false;
            } else {
                $committed += $wage['total'];
            }
        }
        $remaining = $labor !== null && $known ? max(0, $labor - $committed) : null;
        $base = array_replace($base, ['requirements' => array_values($requirements), 'laborBudget' => $labor,
            'remainingLaborBudget' => $remaining, 'contractorBudget' => $this->budget($plan, 'Contractor and Project Management Fee')]);
        if (! $requirements) {
            return array_replace($base, ['notice' => 'The saved plan has no specific trade activities we can match reliably. Browse all profiles below.']);
        }
        // Existing search services enforce approval and expose supported public profile facts.
        // Candidate eligibility remains independent of ratings, wage disclosure and AI availability.
        foreach (['worker', 'contractor'] as $role) {
            $roleRequirements = $requirements;
            if ($role === 'contractor') {
                // Compatibility must be explicit in the approved scope/title, not inferred
                // from the total budget, floor count or a homeowner's later project rename.
                foreach ($this->contractorScopes(implode(' ', array_filter([
                    $plan['projectTitle'] ?? null, $plan['projectType'] ?? null,
                ], 'is_string'))) as $scope) {
                    $roleRequirements[$scope] = ['skill' => $scope, 'phases' => []];
                }
            }
            $people = $role === 'worker' ? $this->workers->search(null, [], $owner) : $this->contractors->search(null, []);
            $assigned = ($role === 'worker' ? $project->workers : $project->contractors)->pluck('id')->all();
            $assignments = Project::whereIn('status', ['active', Project::PENDING_CONFIRMATION])->whereKeyNot($project->id)
                ->whereHas($role === 'worker' ? 'workers' : 'contractors', fn ($q) => $q->whereIn('users.id', $people->pluck('id')))
                ->with($role === 'worker' ? 'workers:id' : 'contractors:id')->get();
            $matches = [];
            foreach ($people as $person) {
                if (in_array($person['id'], $assigned, true)) {
                    continue;
                }
                $profileEvidence = array_merge($person['skills']->all(), [$person[$role === 'worker' ? 'trade' : 'specialization'] ?? '']);
                $concepts = $this->concepts(implode('; ', $profileEvidence));
                if ($role === 'contractor' && (! $concepts || array_intersect($concepts, array_keys($requirements)))) {
                    // A broad "renovation" label cannot rescue a profile whose recorded
                    // specialty is exclusively an unrelated trade (for example roofing).
                    $concepts = array_merge($concepts, $this->contractorScopes(implode('; ', $profileEvidence)));
                }
                $matched = array_intersect_key($roleRequirements, array_flip($concepts));
                // Also support literal registered skills beyond the trade vocabulary.
                foreach ($roleRequirements as $key => $requirement) {
                    foreach ($profileEvidence as $skill) {
                        if ($this->normal($skill) === $this->normal($requirement['skill'])) {
                            $matched[$key] = $requirement;
                        }
                    }
                }
                if (! $matched) {
                    continue;
                }
                $phases = [];
                foreach ($matched as $requirement) {
                    foreach ($requirement['phases'] as $phase) {
                        $phases[$phase['index']] = $phase;
                    }
                }
                $days = $phases && ! collect($matched)->contains(fn ($r) => ! $r['phases'])
                    && ! collect($phases)->contains(fn ($p) => $p['workingDays'] === null)
                    ? array_sum(array_column($phases, 'workingDays')) : null;
                $rate = $role === 'worker' && ($person['minDailyWage'] ?? 0) > 0 ? $person['minDailyWage'] : null;
                $estimate = $rate !== null && $days !== null ? $rate * $days : null;
                $budgetFit = $remaining !== null && $estimate !== null ? $estimate <= $remaining : null;
                $overlaps = 0;
                $scheduleKnown = $phases && ! collect($phases)->contains(fn ($p) => ! $p['start'] || ! $p['end']);
                foreach ($assignments as $other) {
                    if (! ($role === 'worker' ? $other->workers : $other->contractors)->contains('id', $person['id'])) {
                        continue;
                    }
                    if (! $other->started_at) {
                        $scheduleKnown = false;
                        continue;
                    }
                    foreach ($phases as $phase) {
                        if ($phase['start'] && $phase['end'] && $other->started_at->toDateString() <= $phase['end']
                            && $other->timelineEndDate($other->started_at)->toDateString() >= $phase['start']) {
                            $overlaps++;
                            break;
                        }
                    }
                }
                $skills = array_column($matched, 'skill');
                $phaseNames = array_values(array_unique(array_column($phases, 'name')));
                $current = count(array_filter($phases, fn ($p) => $p['start'] && $p['end'] && $p['start'] <= now()->toDateString() && $p['end'] >= now()->toDateString()));
                $matches[] = Arr::except($person, ['email', 'score', 'matchedSkillCount']) + [
                    'matchedSkillCount' => count($matched),
                    'role' => $role, 'matchedSkills' => $skills, 'matchedPhases' => $phaseNames,
                    'reason' => 'Recorded '.($role === 'worker' ? 'trade/skills' : 'specialization/services').' match '.implode(', ', $skills)
                        .($phaseNames ? ' in the approved activities: '.implode(', ', $phaseNames).'.' : ' explicitly required by the approved plan.'),
                    'estimatedDays' => $days, 'estimatedWage' => $estimate,
                    'durationBasis' => $days === null ? null : 'Provisional full matching-phase duration; saved dates or approved durationWeeks, using the app working-days/month convention. Not a staffing commitment.',
                    'budgetFit' => $budgetFit, 'scheduleOverlapCount' => $overlaps,
                    'availability' => $overlaps ? 'Recorded assignment overlap; confirm scheduling' : 'Availability not verified',
                    'scheduleChecked' => (bool) $scheduleKnown, 'bestMatch' => false,
                    '_rank' => [count($matched), $current, $budgetFit === true ? 1 : 0, -$overlaps, $person['averageRating'] ?? 0],
                ];
            }
            usort($matches, fn ($a, $b) => ($b['_rank'] <=> $a['_rank']) ?: ($a['id'] <=> $b['id']));
            // A best-match claim needs a strictly stronger skills match, not merely a rating tie-break.
            if (count($matches) > 1 && $matches[0]['_rank'][0] > $matches[1]['_rank'][0]) {
                $matches[0]['bestMatch'] = true;
            }
            $base[$role === 'worker' ? 'workers' : 'contractors'] = array_map(fn ($m) => Arr::except($m, ['_rank']), $matches);
        }

        return $base;
    }

    private function requirements(Project $project, array $plan): array
    {
        $result = [];
        foreach ((is_array($plan['phases'] ?? null) ? $plan['phases'] : []) as $index => $phase) {
            if (! is_array($phase) || ! is_string($phase['name'] ?? null)) {
                continue;
            }
            $tasks = array_filter(is_array($phase['tasks'] ?? null) ? $phase['tasks'] : [], 'is_string');
            $concepts = $this->concepts(implode('; ', [$phase['name'], ...$tasks]));
            $saved = $project->phases->first(fn ($p) => $this->normal($p->name) === $this->normal($phase['name']));
            $days = $saved?->planned_start && $saved?->planned_end
                ? (int) $saved->planned_start->diffInDays($saved->planned_end) + 1
                : (is_numeric($phase['durationWeeks'] ?? null) && $phase['durationWeeks'] > 0 ? $phase['durationWeeks'] * 7 : null);
            $workdays = $days !== null && $days > 0 ? max(1, (int) ceil($days * config('wages.working_days_per_month', 26) / 30)) : null;
            foreach ($concepts as $skill) {
                $result[$skill] ??= ['skill' => $skill, 'phases' => []];
                $result[$skill]['phases'][] = ['index' => $index, 'name' => $phase['name'], 'workingDays' => $workdays,
                    'start' => $saved?->planned_start?->toDateString(), 'end' => $saved?->planned_end?->toDateString()];
            }
        }
        // Optional explicit approved requirements can match custom profile skills, without inventing phases/days.
        foreach ((is_array($plan['requiredSkills'] ?? null) ? $plan['requiredSkills'] : []) as $skill) {
            if (is_string($skill) && trim($skill) !== '') {
                $result[trim($skill)] ??= ['skill' => trim($skill), 'phases' => []];
            }
        }

        return $result;
    }

    private function concepts(string $text): array
    {
        $text = $this->normal($text);
        $found = [];
        foreach (self::TERMS as $concept => $terms) {
            foreach ($terms as $term) {
                // Do not turn exclusions such as "no electrical work" into requirements.
                $positive = preg_replace('/\b(?:no|not|without|exclude|excluding)\s+(?:\w+\s+){0,2}'.preg_quote($term, '/').'\b/u', '', $text);
                if (preg_match('/\b'.preg_quote($term, '/').'\b/u', $positive)) {
                    $found[] = $concept;
                    break;
                }
            }
        }

        return $found;
    }

    private function normal(string $text): string
    {
        return trim(preg_replace('/[^\pL\pN]+/u', ' ', Str::lower($text)));
    }

    private function contractorScopes(string $text): array
    {
        $text = $this->normal($text);
        $scopes = [];
        if (preg_match('/\b(?:renovation|renovations|remodeling|remodelling)\b/u', $text)) {
            $scopes[] = 'Renovation contracting';
        }
        if (preg_match('/\b(?:residential construction|house construction|home construction|new house|residential building)\b/u', $text)) {
            $scopes[] = 'Residential construction';
        }

        return $scopes;
    }

    private function budget(array $plan, string $category): ?int
    {
        $line = collect($plan['budgetBreakdown'] ?? [])->first(fn ($b) => is_array($b) && ($b['category'] ?? null) === $category);

        return $line && is_numeric($line['amount'] ?? null) && $line['amount'] >= 0 ? (int) $line['amount'] : null;
    }
}
