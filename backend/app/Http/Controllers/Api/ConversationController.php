<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ListMessagesRequest;
use App\Http\Requests\SendMessageRequest;
use App\Http\Requests\StartConversationRequest;
use App\Models\Conversation;
use App\Models\Project;
use App\Services\ChatService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class ConversationController extends Controller
{
    public function __construct(private readonly ChatService $chat) {}

    public function index(Request $request): JsonResponse
    {
        return response()->json($this->chat->listFor($request->user()));
    }

    public function unreadCount(Request $request): JsonResponse
    {
        return response()->json(['count' => $this->chat->unreadCountFor($request->user())]);
    }

    public function store(StartConversationRequest $request): JsonResponse
    {
        $project = Project::findOrFail($request->validated('project_id'));
        $contractorId = $request->validated('contractor_id');
        $workerId = $request->validated('worker_id');

        try {
            $conversation = $this->chat->start(
                $request->user(),
                $project,
                $contractorId !== null ? (int) $contractorId : null,
                $workerId !== null ? (int) $workerId : null,
            );
        } catch (ValidationException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }

        return response()->json($conversation);
    }

    public function show(Request $request, Conversation $conversation): JsonResponse
    {
        try {
            return response()->json($this->chat->show($conversation, $request->user()));
        } catch (ValidationException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }

    public function messages(ListMessagesRequest $request, Conversation $conversation): JsonResponse
    {
        $afterId = $request->validated('after_id');

        try {
            $messages = $this->chat->messagesFor($conversation, $request->user(), $afterId !== null ? (int) $afterId : null);
        } catch (ValidationException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }

        return response()->json($messages);
    }

    public function send(SendMessageRequest $request, Conversation $conversation): JsonResponse
    {
        try {
            $message = $this->chat->send($conversation, $request->user(), $request->validated('body'), $request->validated('client_key'));
        } catch (ValidationException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }

        return response()->json($message, 201);
    }

    public function markRead(Request $request, Conversation $conversation): JsonResponse
    {
        try {
            $count = $this->chat->markRead($conversation, $request->user());
        } catch (ValidationException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }

        return response()->json(['marked' => $count]);
    }
}
