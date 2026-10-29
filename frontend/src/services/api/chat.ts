import { apiFetch } from "@/services/api/client";
import type { ChatMessage, Conversation } from "@/types/chat";

export async function fetchConversations(): Promise<Conversation[]> {
  return (await apiFetch("/api/conversations")) as Conversation[];
}

export async function fetchChatUnreadCount(): Promise<number> {
  const data = (await apiFetch("/api/conversations/unread-count")) as { count: number };
  return data.count;
}

/** Opens or reuses a private project thread. Select a contractor or worker, or omit both
 * ids as a contractor/worker to message the project owner. */
export async function startConversation(projectId: number, contractorId?: number, workerId?: number): Promise<Conversation> {
  return (await apiFetch("/api/conversations", {
    method: "POST",
    body: JSON.stringify({
      project_id: projectId,
      ...(contractorId ? { contractor_id: contractorId } : {}),
      ...(workerId ? { worker_id: workerId } : {}),
    }),
  })) as Conversation;
}

export async function fetchConversation(id: number): Promise<Conversation> {
  return (await apiFetch(`/api/conversations/${id}`)) as Conversation;
}

/** Ascending history; with `afterId`, only messages newer than it (what the chat polls with). */
export async function fetchMessages(conversationId: number, afterId?: number): Promise<ChatMessage[]> {
  const query = afterId ? `?after_id=${afterId}` : "";
  return (await apiFetch(`/api/conversations/${conversationId}/messages${query}`)) as ChatMessage[];
}

/** `clientKey` makes retries idempotent — resending the same key returns the original message. */
export async function sendMessage(conversationId: number, body: string, clientKey: string): Promise<ChatMessage> {
  return (await apiFetch(`/api/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify({ body, client_key: clientKey }),
  })) as ChatMessage;
}

export async function markConversationRead(conversationId: number): Promise<void> {
  await apiFetch(`/api/conversations/${conversationId}/read`, { method: "POST" });
}
