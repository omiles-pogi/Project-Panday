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

        return $this->attempt(fn () => $this->chat->start(
            $request->user(),
            $project,
            $contractorId !== null ? (int) $contractorId : null,
            $workerId !== null ? (int) $workerId : null,
        ));
    }

    public function show(Request $request, Conversation $conversation): JsonResponse
    {
        return $this->attempt(fn () => $this->chat->show($conversation, $request->user()));
    }

    public function messages(ListMessagesRequest $request, Conversation $conversation): JsonResponse
    {
        $afterId = $request->validated('after_id');

        return $this->attempt(fn () => $this->chat->messagesFor($conversation, $request->user(), $afterId !== null ? (int) $afterId : null));
    }

    public function send(SendMessageRequest $request, Conversation $conversation): JsonResponse
    {
        return $this->attempt(fn () => $this->chat->send($conversation, $request->user(), $request->validated('body'), $request->validated('client_key')), 201);
    }

    public function markRead(Request $request, Conversation $conversation): JsonResponse
    {
        return $this->attempt(fn () => ['marked' => $this->chat->markRead($conversation, $request->user())]);
    }
}
