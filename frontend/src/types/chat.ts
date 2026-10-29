import type { UserRole } from "@/types/auth";

export interface ChatParticipant {
  id: number;
  name: string;
  role: UserRole;
}

export interface Conversation {
  id: number;
  project: { id: number; title: string } | null;
  otherParticipant: ChatParticipant;
  lastMessage: { body: string; senderId: number; isMine: boolean; createdAt: string } | null;
  lastMessageAt: string;
  unreadCount: number;
  /** False once either participant leaves the project — history stays readable. */
  canSend: boolean;
}

export interface ChatMessage {
  id: number;
  conversationId: number;
  senderId: number;
  senderName: string;
  senderRole: UserRole;
  body: string;
  clientKey: string | null;
  isMine: boolean;
  readAt: string | null;
  createdAt: string;
}
