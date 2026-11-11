<?php

namespace Database\Seeders;

use App\Models\AppNotification;
use App\Models\Conversation;
use App\Models\MaterialRequest;
use App\Models\Project;
use App\Models\ProjectContractorRequest;
use App\Models\ProjectWorkerRequest;
use App\Models\User;
use App\Services\ChatService;
use App\Services\MaterialPlanService;
use App\Services\MaterialRequestService;
use App\Services\ProjectService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

/**
 * Builds one fully realistic, "lived-in" project under the demo homeowner Maria Santos, for
 * demoing the app with a panel: every row comes from the same services the real app uses (the AI
 * plan, invites, checklist, material requests, chat, notifications) — only the clock is moved
 * back while each step runs, so the project reads as ~3.5 weeks of real use instead of being
 * created a second ago. No table is written to directly; nothing here is free-text filler.
 *
 *   php artisan db:seed --class=DemoProjectJourneySeeder
 *
 * Safe to re-run: deletes its own previous project (by title, under Maria) first, so the story
 * never piles up duplicates.
 *
 * Leaves the "Electrical and Plumbing" and "Finishing" phases entirely unchecked, and one material
 * request sitting in "pending_homeowner_approval" — real, interactive next steps to demo live
 * (check off a task, approve the request) rather than a frozen, already-finished snapshot.
 */
class DemoProjectJourneySeeder extends Seeder
{
    private const TITLE = 'Bedroom and Bathroom Extension';

    private const PHASES = [
        [
            'name' => 'Foundation and Excavation',
            'percentComplete' => 15,
            'durationWeeks' => 1,
            'tasks' => [
                'Lay out and stake the extension area',
                'Excavate footings',
                'Install footing rebar and formworks',
                'Pour footing and column base concrete',
            ],
        ],
        [
            'name' => 'Framing and Masonry',
            'percentComplete' => 30,
            'durationWeeks' => 3,
            'tasks' => [
                'Erect columns and tie beams',
                'Lay CHB walls for the extension',
                'Install roof framing and trusses',
                'Plaster rough-in walls',
            ],
        ],
        [
            'name' => 'Roofing',
            'percentComplete' => 10,
            'durationWeeks' => 1,
            'tasks' => [
                'Install roof purlins',
                'Lay long-span roofing sheets',
                'Install ridge cap and flashing',
            ],
        ],
        [
            'name' => 'Electrical and Plumbing',
            'percentComplete' => 15,
            'durationWeeks' => 2,
            'tasks' => [
                'Rough-in electrical wiring',
                'Rough-in water supply and drainage lines',
                'Install panel breaker and outlets',
                'Pressure test plumbing lines',
            ],
        ],
        [
            'name' => 'Finishing',
            'percentComplete' => 30,
            'durationWeeks' => 2,
            'tasks' => [
                'Plaster and skim coat walls',
                'Lay floor and wall tiles',
                'Install doors, hinges and lockset',
                'Paint interior and exterior walls',
                'Install fixtures and final cleanup',
            ],
        ],
    ];

    /** [material, supplierProductId, qty, unit, unitPrice, phase] — supplierProductId is Bagong
     * Buhay Hardware's real catalog (see SupplierSheetSeeder/DemoPeopleSeeder); category/name/price
     * are re-verified and overwritten from that live listing by ProjectService::planAttributes(), so
     * this is never a made-up price. */
    private const MATERIALS = [
        ['Portland Cement Type I (40kg)', 2, 60, 'bag', 248, 'Foundation and Excavation'],
        ['Washed Sand', 4, 8, 'cu.m', 1420, 'Foundation and Excavation'],
        ['Gravel 3/4"', 5, 6, 'cu.m', 1580, 'Foundation and Excavation'],
        ['Deformed Steel Bar 10mm x 6m', 6, 80, 'piece', 185, 'Foundation and Excavation'],
        ['CHB 4" Hollow Block', 9, 900, 'piece', 14, 'Framing and Masonry'],
        ['Deformed Steel Bar 12mm x 6m', 7, 60, 'piece', 268, 'Framing and Masonry'],
        ['Marine Plywood 3/4" (4x8)', 12, 12, 'sheet', 1420, 'Framing and Masonry'],
        ['Coco Lumber 2" x 3" x 10ft', 11, 40, 'piece', 158, 'Framing and Masonry'],
        ['Long Span Pre-Painted Roofing (0.4mm)', 14, 90, 'meter', 365, 'Roofing'],
        ['PVC Pipe 4" x 3m (Sanitary)', 15, 10, 'piece', 545, 'Electrical and Plumbing'],
        ['THHN Wire 3.5mm² (75m roll)', 16, 2, 'roll', 3380, 'Electrical and Plumbing'],
        ['Latex Paint White (4L)', 17, 6, 'gallon', 745, 'Finishing'],
        ['Door Hinges', 217, 4, 'set', 73, 'Finishing'],
        ['Door Lockset / Doorknob', 222, 2, 'set', 330, 'Finishing'],
        ['Tile Grout', 382, 10, 'bag', 94, 'Finishing'],
    ];

    public function run(): void
    {
        $maria = User::where('email', 'maria@panday.test')->firstOrFail();
        $porman = User::where('email', 'porman@panday.test')->firstOrFail();
        $rene = User::where('email', 'rene@panday.test')->firstOrFail();
        $kulas = User::where('email', 'kulas@panday.test')->firstOrFail();
        $jun = User::where('email', 'jun@panday.test')->firstOrFail();
        $bagongBuhay = User::where('email', 'bagongbuhay@panday.test')->firstOrFail();

        $projects = app(ProjectService::class);
        $materialPlans = app(MaterialPlanService::class);
        $materialRequests = app(MaterialRequestService::class);
        $chat = app(ChatService::class);

        $existing = Project::where('user_id', $maria->id)->where('title', self::TITLE)->first();
        if ($existing) {
            // deleteProject() cascades the project's own rows, but a notification only carries the
            // project's id in its JSON `data`, not a real foreign key, so it survives on its own.
            AppNotification::where('data->projectId', $existing->id)->delete();
            $projects->deleteProject($existing, $maria);
        }

        $today = Carbon::today();

        try {
            Carbon::setTestNow($today->copy()->subDays(24)->setTime(9, 0));
            $project = $projects->createFromPlan($maria, $this->plan($bagongBuhay->id));

            Carbon::setTestNow($today->copy()->subDays(24)->setTime(11, 0));
            $contractorRequestId = $projects->assignContractor($project, $maria, $porman)['id'];

            Carbon::setTestNow($today->copy()->subDays(23)->setTime(10, 0));
            $projects->respondToContractorRequest(ProjectContractorRequest::findOrFail($contractorRequestId), $porman, true);

            Carbon::setTestNow($today->copy()->subDays(23)->setTime(14, 0));
            $workerRequestIds = [];
            foreach ([$rene, $kulas, $jun] as $worker) {
                $workerRequestIds[$worker->id] = $projects->assignWorker($project, $maria, $worker)['id'];
            }

            $minute = 0;
            foreach ([$rene, $kulas, $jun] as $worker) {
                Carbon::setTestNow($today->copy()->subDays(22)->setTime(9, $minute));
                $projects->respondToWorkerRequest(ProjectWorkerRequest::findOrFail($workerRequestIds[$worker->id]), $worker, true);
                $minute += 15;
            }

            // A fresh instance: earlier calls above lazily cached this project's `contractors`/`workers`
            // relations from before anyone had accepted, and a stale empty collection would make every
            // later "is this person assigned?" check fail even though the DB rows are now there.
            $project = $project->fresh();

            Carbon::setTestNow($today->copy()->subDays(22)->setTime(16, 0));
            // The same row ChatService::start() would create for this homeowner/contractor pair —
            // fetching the model directly here since start() returns a presented array, not it.
            $conversation = Conversation::createOrFirst([
                'project_id' => $project->id,
                'homeowner_id' => $maria->id,
                'contractor_id' => $porman->id,
                'worker_id' => null,
            ]);

            Carbon::setTestNow($today->copy()->subDays(22)->setTime(16, 2));
            $chat->send($conversation, $maria, 'Hi Porman! Excited to start on the bedroom and bathroom extension. Let me know kung ano pa kailangan sa part namin para makapagsimula agad.', null);
            Carbon::setTestNow($today->copy()->subDays(22)->setTime(16, 10));
            $chat->send($conversation, $porman, 'Hi Maria, salamat sa tiwala! Sisimulan namin ang site layout at excavation this week. I-uupdate ko po kayo sa progress.', null);

            Carbon::setTestNow($today->copy()->subDays(21)->setTime(8, 0));
            $materialPlans->review($project, $porman, []);

            $foundationPhase = $project->phases->firstWhere('name', 'Foundation and Excavation');
            Carbon::setTestNow($today->copy()->subDays(21)->setTime(9, 0));
            $foundationRequestId = $materialPlans->requestForPhase($project, $porman, $foundationPhase)['id'];
            $materialRequests->submit(MaterialRequest::findOrFail($foundationRequestId), $porman);

            // Foundation and Excavation — all 4 tasks, one every day or two.
            $this->checkOff($projects, $project, $porman, 'Foundation and Excavation', [-20, -19, -18, -17]);

            Carbon::setTestNow($today->copy()->subDays(17)->setTime(9, 0));
            $chat->send($conversation, $porman, 'Good morning Maria! Tapos na po yung foundation work, magsisimula na kami sa framing at masonry ngayong linggo.', null);
            Carbon::setTestNow($today->copy()->subDays(17)->setTime(9, 5));
            $chat->send($conversation, $maria, 'Ang bilis! Salamat sa update, Porman.', null);

            // Framing and Masonry — all 4 tasks.
            $this->checkOff($projects, $project, $porman, 'Framing and Masonry', [-15, -12, -10, -8]);

            Carbon::setTestNow($today->copy()->subDays(8)->setTime(14, 0));
            $chat->send($conversation, $porman, 'Update po: tapos na rin ang framing at masonry, magsisimula na kami sa roofing.', null);

            // Roofing — all 3 tasks. Project sits at 55% (Foundation+Framing+Roofing weights) after this.
            $this->checkOff($projects, $project, $porman, 'Roofing', [-7, -6, -5]);

            Carbon::setTestNow($today->copy()->subDays(5)->setTime(10, 0));
            $chat->send($conversation, $porman, 'Done na rin po ang roofing. Susunod na electrical and plumbing rough-in, saka magrereview muna ako ng material request para dun.', null);
            Carbon::setTestNow($today->copy()->subDays(5)->setTime(10, 10));
            $chat->send($conversation, $maria, 'Perfect timing, kailangan ko lang siguraduhin yung budget muna. Salamat Porman!', null);

            // From here on, requests need Maria's own approval — demoed live, not auto-approved.
            Carbon::setTestNow($today->copy()->subDays(4)->setTime(9, 0));
            $materialPlans->setAutoApprove($project, $maria, false);

            $electricalPhase = $project->fresh('phases.tasks')->phases->firstWhere('name', 'Electrical and Plumbing');
            Carbon::setTestNow(null);
            $electricalRequestId = $materialPlans->requestForPhase($project, $porman, $electricalPhase)['id'];
            $materialRequests->submit(MaterialRequest::findOrFail($electricalRequestId), $porman);
        } finally {
            Carbon::setTestNow(null);
        }

        $this->command?->info('Demo project journey seeded for maria@panday.test: "'.self::TITLE.'" — ~55% complete, one material request pending her approval.');
    }

    /** @param int[] $dayOffsets one per task, in order, each negative (days before today) */
    private function checkOff(ProjectService $projects, Project $project, User $contractor, string $phaseName, array $dayOffsets): void
    {
        $phase = $project->fresh('phases.tasks')->phases->firstWhere('name', $phaseName);
        $tasks = $phase->tasks->sortBy('id')->values();
        $today = Carbon::today();

        foreach ($dayOffsets as $i => $offset) {
            Carbon::setTestNow($today->copy()->addDays($offset)->setTime(10, 0));
            $projects->updatePhaseTask($tasks[$i], $contractor, true);
        }
    }

    /** @return array<string, mixed> a StoreProjectRequest-shaped plan payload */
    private function plan(int $supplierId): array
    {
        return [
            'projectTitle' => self::TITLE,
            'location' => 'Quezon City, Metro Manila',
            'budget' => 345000,
            'totalEstimate' => 336982,
            'timelineValue' => 2,
            'timelineUnit' => 'months',
            'designStyle' => 'Simple modern',
            'areaSqm' => 24,
            'floors' => 1,
            'bedrooms' => 1,
            'bathrooms' => 1,
            'garageCars' => 0,
            'exteriorConcept' => "Simple modern extension with ridge-cap long-span roofing to blend with the existing house's roofline.",
            'interiorConcept' => 'Bright, minimalist bedroom with an attached tiled bathroom — white walls, warm wood accents.',
            'budgetBreakdown' => [
                ['category' => 'Foundation and Excavation', 'amount' => 18000],
                ['category' => 'Construction Materials', 'amount' => 136362],
                ['category' => 'Labor Costs', 'amount' => 125000],
                ['category' => 'Contractor and Project Management Fee', 'amount' => 40000],
                ['category' => 'Electrical and Plumbing', 'amount' => 12210],
                ['category' => 'Finishing Works', 'amount' => 5410],
            ],
            'supplierSelections' => [
                'Construction Materials' => $supplierId,
                'Electrical and Plumbing' => $supplierId,
                'Finishing Works' => $supplierId,
            ],
            'phases' => self::PHASES,
            'materials' => array_map(fn (array $m) => [
                'material' => $m[0],
                'category' => null,
                'qty' => $m[2],
                'unit' => $m[3],
                'unitPrice' => $m[4],
                'supplierProductId' => $m[1],
                'supplierName' => null,
                'phase' => $m[5],
            ], self::MATERIALS),
        ];
    }
}
