<?php

use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ConstructionPlanController;
use App\Http\Controllers\Api\ContractorController;
use App\Http\Controllers\Api\ContractorRequestController;
use App\Http\Controllers\Api\ConversationController;
use App\Http\Controllers\Api\DeviceTokenController;
use App\Http\Controllers\Api\HiringWageController;
use App\Http\Controllers\Api\HomeownerProfileController;
use App\Http\Controllers\Api\MaterialCatalogController;
use App\Http\Controllers\Api\MaterialPlanController;
use App\Http\Controllers\Api\MaterialRequestController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\ProjectCompletionController;
use App\Http\Controllers\Api\ProjectController;
use App\Http\Controllers\Api\ProjectDashboardController;
use App\Http\Controllers\Api\ProjectHistoryController;
use App\Http\Controllers\Api\ProjectNamingController;
use App\Http\Controllers\Api\ProjectPhaseTaskController;
use App\Http\Controllers\Api\ProjectRatingController;
use App\Http\Controllers\Api\ProjectTimelineController;
use App\Http\Controllers\Api\SupplierFulfillmentController;
use App\Http\Controllers\Api\SupplierHistoryController;
use App\Http\Controllers\Api\SupplierProductController;
use App\Http\Controllers\Api\SupplierProfileController;
use App\Http\Controllers\Api\WorkerActivityController;
use App\Http\Controllers\Api\WorkerController;
use App\Http\Controllers\Api\WorkerRequestController;
use Illuminate\Support\Facades\Route;

Route::post('/auth/register', [AuthController::class, 'register'])->middleware('throttle:10,1');
Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:10,1');
Route::post('/auth/approval-status', [AuthController::class, 'approvalStatus'])->middleware('throttle:30,1');
Route::post('/auth/forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:5,1');
Route::post('/auth/verify-password-reset-code', [AuthController::class, 'verifyPasswordResetCode'])->middleware('throttle:5,1');
Route::post('/auth/reset-password', [AuthController::class, 'resetPassword'])->middleware('throttle:5,1');

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::patch('/auth/me', [AuthController::class, 'updateMe']);
    Route::post('/ai/plan', [ConstructionPlanController::class, 'store'])->middleware('throttle:20,1');
    Route::get('/ai/supplier-options', [ConstructionPlanController::class, 'supplierOptions'])->middleware('role:homeowner');
    Route::post('/projects', [ProjectController::class, 'store']);
    // "New Project" adds a not-started placeholder right away; approving its AI plan fills it in and starts it.
    Route::post('/projects/draft', [ProjectController::class, 'storeDraft'])->middleware('role:homeowner');
    Route::post('/projects/{project}/plan', [ProjectController::class, 'activate'])->middleware('role:homeowner');
    Route::get('/projects', [ProjectController::class, 'index']);
    Route::middleware('role:homeowner')->group(function () {
        Route::get('/project-history', [ProjectHistoryController::class, 'index']);
        Route::get('/project-history/{projectId}', [ProjectHistoryController::class, 'show'])->whereNumber('projectId');
        Route::patch('/projects/{project}/name', [ProjectNamingController::class, 'update'])->whereNumber('project');
        Route::patch('/projects/{project}/hide-from-dashboard', [ProjectDashboardController::class, 'hide'])->whereNumber('project');
        Route::get('/home-dashboard', [ProjectDashboardController::class, 'overview']);
    });
    Route::get('/projects/available', [ProjectController::class, 'available']);
    Route::get('/projects/available-for-contractors', [ProjectController::class, 'availableForContractors']);
    Route::delete('/projects/{project}', [ProjectController::class, 'destroy']);
    Route::get('/dashboard', [ProjectController::class, 'dashboard']);
    Route::post('/projects/{project}/budget', [ProjectController::class, 'addBudget'])->middleware('role:homeowner');
    Route::get('/projects/{project}/hiring-wages', [HiringWageController::class, 'show'])->middleware('role:homeowner');
    Route::post('/projects/{project}/workers', [ProjectController::class, 'assignWorker']);
    Route::delete('/projects/{project}/workers/{worker}', [ProjectController::class, 'unassignWorker']);
    // What a team member is paid on the project: the homeowner sets anyone's, a contractor on the project their workers'.
    Route::patch('/projects/{project}/workers/{worker}/wage', [ProjectController::class, 'setWorkerWage']);
    Route::patch('/projects/{project}/contractors/{contractor}/wage', [ProjectController::class, 'setContractorWage']);
    Route::post('/projects/{project}/contractors', [ProjectController::class, 'assignContractor']);
    Route::delete('/projects/{project}/contractors/{contractor}', [ProjectController::class, 'unassignContractor']);
    Route::get('/my-projects', [ProjectController::class, 'myProjects']);
    Route::get('/projects/{project}/activity-log', [ProjectController::class, 'activityLog']);
    // Calendar monitoring (AI-proposed schedule vs actual progress): homeowner and contractor only.
    Route::get('/projects/{project}/timeline', [ProjectTimelineController::class, 'show'])->middleware('role:homeowner,contractor');
    // End-of-project reviews: the homeowner rates their team once the project is 100% complete.
    Route::get('/projects/{project}/ratings', [ProjectRatingController::class, 'show']);
    Route::post('/projects/{project}/ratings', [ProjectRatingController::class, 'store']);
    Route::post('/projects/{project}/apply', [ProjectController::class, 'applyAsWorker'])->middleware('role:worker');
    Route::post('/projects/{project}/apply-contractor', [ProjectController::class, 'applyAsContractor'])->middleware('role:contractor');
    // The project details behind an invite/application, for the person it belongs to — before they accept/decline.
    Route::get('/worker-requests/{workerRequest}/project', [WorkerRequestController::class, 'project']);
    Route::get('/contractor-requests/{contractorRequest}/project', [ContractorRequestController::class, 'project']);
    Route::patch('/worker-requests/{workerRequest}/respond', [WorkerRequestController::class, 'respond']);
    Route::patch('/contractor-requests/{contractorRequest}/respond', [ContractorRequestController::class, 'respond']);

    Route::post('/projects/{project}/phases/{phase}/tasks', [ProjectPhaseTaskController::class, 'store']);
    Route::patch('/projects/{project}/phases/{phase}/tasks/{task}', [ProjectPhaseTaskController::class, 'update']);
    Route::delete('/projects/{project}/phases/{phase}/tasks/{task}', [ProjectPhaseTaskController::class, 'destroy']);

    // The phone's push token, registered after sign-in and removed on sign-out.
    Route::post('/device-tokens', [DeviceTokenController::class, 'store']);
    Route::delete('/device-tokens', [DeviceTokenController::class, 'destroy']);
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount']);
    Route::patch('/notifications/{notification}/read', [NotificationController::class, 'markRead']);
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllRead']);
    Route::delete('/notifications', [NotificationController::class, 'clearAll']);
    Route::delete('/notifications/{notification}', [NotificationController::class, 'destroy']);

    Route::put('/worker-profile', [WorkerController::class, 'updateProfile'])->middleware('role:worker');
    Route::get('/workers', [WorkerController::class, 'search']);
    Route::get('/workers/{worker}', [WorkerController::class, 'show']);
    Route::post('/workers/{worker}/ratings', [WorkerController::class, 'rate']);

    Route::put('/contractor-profile', [ContractorController::class, 'updateProfile'])->middleware('role:contractor');
    Route::get('/contractors', [ContractorController::class, 'search']);
    Route::get('/contractors/{contractor}', [ContractorController::class, 'show']);
    Route::post('/contractors/{contractor}/ratings', [ContractorController::class, 'rate']);

    Route::get('/homeowner-profile', [HomeownerProfileController::class, 'show'])->middleware('role:homeowner');
    Route::put('/homeowner-profile', [HomeownerProfileController::class, 'update'])->middleware('role:homeowner');

    // Finishing a project: the assigned contractor checks off the checklist (a whole phase at a time, or task by
    // task) and submits the project as finished — or, on a small project with no contractor assigned, the
    // homeowner does this themselves. Either way the homeowner then confirms completion or asks for
    // corrections (skipped entirely when the homeowner submitted it themselves). Ownership, contractor
    // assignment and status are re-checked in ProjectCompletionService, so these role gates are only the
    // first line.
    Route::middleware('role:homeowner,contractor')->group(function () {
        Route::post('/projects/{project}/phases/{phase}/checklist/check-all', [ProjectCompletionController::class, 'checkAll']);
        Route::post('/projects/{project}/phases/{phase}/checklist/uncheck-all', [ProjectCompletionController::class, 'uncheckAll']);
        Route::post('/projects/{project}/completion/submit', [ProjectCompletionController::class, 'submit']);
    });
    Route::middleware('role:homeowner')->group(function () {
        Route::post('/projects/{project}/completion/confirm', [ProjectCompletionController::class, 'confirm']);
        Route::post('/projects/{project}/completion/request-corrections', [ProjectCompletionController::class, 'requestCorrections']);
    });

    // A worker's day on site — attendance, the daily log and earnings — and the team's view of it.
    Route::middleware('role:worker')->group(function () {
        Route::get('/worker/attendance', [WorkerActivityController::class, 'attendance']);
        Route::post('/projects/{project}/attendance/check-in', [WorkerActivityController::class, 'checkIn']);
        Route::post('/projects/{project}/attendance/check-out', [WorkerActivityController::class, 'checkOut']);
        Route::get('/worker/work-logs', [WorkerActivityController::class, 'workLogs']);
        Route::put('/projects/{project}/work-log', [WorkerActivityController::class, 'saveWorkLog']);
        Route::get('/worker/earnings', [WorkerActivityController::class, 'earnings']);
    });
    Route::get('/projects/{project}/team-activity', [WorkerActivityController::class, 'team'])->middleware('role:homeowner,contractor');

    Route::get('/supplier-profile', [SupplierProfileController::class, 'show'])->middleware('role:supplier');
    Route::put('/supplier-profile', [SupplierProfileController::class, 'update'])->middleware('role:supplier');

    Route::get('/supplier-products', [SupplierProductController::class, 'index'])->middleware('role:supplier');
    Route::post('/supplier-products', [SupplierProductController::class, 'store'])->middleware('role:supplier');
    Route::patch('/supplier-products/{supplierProduct}', [SupplierProductController::class, 'update'])->middleware('role:supplier');
    Route::delete('/supplier-products/{supplierProduct}', [SupplierProductController::class, 'destroy'])->middleware('role:supplier');

    // Read-only material catalog across all suppliers' active listings.
    Route::middleware('role:homeowner,contractor')->group(function () {
        Route::get('/materials', [MaterialCatalogController::class, 'index']);
        Route::get('/materials/{supplierProduct}', [MaterialCatalogController::class, 'show']);
    });

    // Private project messaging for homeowners, assigned contractors, and assigned workers.
    Route::middleware('role:homeowner,contractor,worker')->group(function () {
        Route::get('/conversations', [ConversationController::class, 'index']);
        Route::get('/conversations/unread-count', [ConversationController::class, 'unreadCount']);
        Route::post('/conversations', [ConversationController::class, 'store']);
        Route::get('/conversations/{conversation}', [ConversationController::class, 'show']);
        Route::get('/conversations/{conversation}/messages', [ConversationController::class, 'messages']);
        Route::post('/conversations/{conversation}/messages', [ConversationController::class, 'send'])->middleware('throttle:60,1');
        Route::post('/conversations/{conversation}/read', [ConversationController::class, 'markRead']);
    });

    // Material workflow: contractor drafts → homeowner approves → suppliers fulfil → contractor receives.
    Route::middleware('role:homeowner,contractor')->group(function () {
        Route::get('/material-requests', [MaterialRequestController::class, 'index']);
        Route::get('/material-requests/{materialRequest}', [MaterialRequestController::class, 'show']);
        Route::post('/material-requests/{materialRequest}/cancel', [MaterialRequestController::class, 'cancel']);
        Route::get('/projects/{project}/ai-materials', [MaterialRequestController::class, 'aiSuggestions']);
        // The plan's materials by phase, each phase with the date its materials are needed by.
        Route::get('/projects/{project}/material-plan', [MaterialPlanController::class, 'show']);
    });
    Route::middleware('role:contractor')->group(function () {
        // Review the AI's quantities once, then raise a request per phase from the reviewed plan.
        Route::put('/projects/{project}/material-plan/review', [MaterialPlanController::class, 'review']);
        Route::post('/projects/{project}/material-plan/phases/{phase}/request', [MaterialPlanController::class, 'requestPhase']);
        Route::post('/material-requests', [MaterialRequestController::class, 'store']);
        Route::put('/material-requests/{materialRequest}', [MaterialRequestController::class, 'update']);
        Route::post('/material-requests/{materialRequest}/submit', [MaterialRequestController::class, 'submit']);
        Route::post('/supplier-fulfillments/{supplierOrder}/receive', [MaterialRequestController::class, 'receive']);
    });
    Route::middleware('role:homeowner')->group(function () {
        // Whether routine requests that stay inside the approved plan approve themselves.
        Route::patch('/projects/{project}/material-settings', [MaterialPlanController::class, 'settings']);
        Route::post('/material-requests/{materialRequest}/approve', [MaterialRequestController::class, 'approve']);
        Route::post('/material-requests/{materialRequest}/request-revision', [MaterialRequestController::class, 'requestRevision']);
        Route::post('/material-requests/{materialRequest}/reject', [MaterialRequestController::class, 'reject']);
        Route::post('/supplier-fulfillments/{supplierOrder}/confirm-prices', [MaterialRequestController::class, 'confirmPrices']);
        Route::post('/supplier-fulfillments/{supplierOrder}/decline-prices', [MaterialRequestController::class, 'declinePrices']);
    });
    Route::middleware('role:supplier')->group(function () {
        Route::get('/supplier-history', [SupplierHistoryController::class, 'index']);
        Route::get('/supplier-history/{projectId}', [SupplierHistoryController::class, 'show'])->whereNumber('projectId');
        Route::get('/supplier-fulfillments', [SupplierFulfillmentController::class, 'index']);
        Route::get('/supplier-fulfillments/{supplierOrder}', [SupplierFulfillmentController::class, 'show']);
        Route::post('/supplier-fulfillments/{supplierOrder}/confirm', [SupplierFulfillmentController::class, 'confirm']);
        Route::post('/supplier-fulfillments/{supplierOrder}/insufficient', [SupplierFulfillmentController::class, 'insufficient']);
        Route::post('/supplier-fulfillments/{supplierOrder}/decline', [SupplierFulfillmentController::class, 'decline']);
    });
});

// Web admin portal — only the single configured superadmin account (see EnsurePortalAdmin).
Route::middleware(['auth:sanctum', 'portal.admin'])->prefix('admin')->group(function () {
    Route::get('/stats', [AdminController::class, 'stats']);
    Route::get('/users', [AdminController::class, 'users']);
    Route::patch('/users/{user}/approval', [AdminController::class, 'updateApproval']);
    Route::get('/projects', [AdminController::class, 'projects']);
});
