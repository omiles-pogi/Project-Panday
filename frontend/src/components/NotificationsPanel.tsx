import { useState } from "react";
import { Text, View, Pressable, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Sheet from "@/components/Sheet";
import { useTheme } from "@/context/ThemeContext";
import { useNotifications } from "@/context/NotificationContext";
import { useAuth } from "@/context/AuthContext";
import type { AppNotification, NotificationType } from "@/types/notification";
import type { IconName } from "@/components/ui";

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const ICON: Record<NotificationType, IconName> = {
  new_message: "chatbubble-ellipses-outline",
  worker_invite: "person-add-outline",
  worker_invite_response: "checkmark-done-outline",
  worker_application: "document-text-outline",
  worker_application_decision: "checkmark-done-outline",
  contractor_invite: "briefcase-outline",
  contractor_invite_response: "checkmark-done-outline",
  contractor_application: "document-text-outline",
  contractor_application_decision: "checkmark-done-outline",
  material_request_submitted: "clipboard-outline",
  material_request_approved: "checkmark-circle-outline",
  material_request_revision: "create-outline",
  material_request_rejected: "close-circle-outline",
  material_request_cancelled: "close-circle-outline",
  material_request_completed: "checkmark-done-circle-outline",
  supplier_order_received: "cube-outline",
  supplier_order_confirmed: "checkmark-circle-outline",
  supplier_price_confirmation: "pricetag-outline",
  supplier_order_unavailable: "alert-circle-outline",
  supplier_order_status: "car-outline",
  supplier_order_cancelled: "close-circle-outline",
  supplier_order_received_by_contractor: "checkmark-done-outline",
};

// Only these carry a pending request that this viewer can act on directly from the panel.
const ACTIONABLE: NotificationType[] = ["worker_invite", "worker_application", "contractor_invite", "contractor_application"];
const INVITE_TYPES: NotificationType[] = ["worker_invite", "contractor_invite"];
const CONTRACTOR_TYPES: NotificationType[] = [
  "contractor_invite",
  "contractor_invite_response",
  "contractor_application",
  "contractor_application_decision",
];

export default function NotificationsPanel({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { chrome } = useTheme();
  const { user } = useAuth();
  const { notifications, loading, markRead, markAllRead, remove, respond } = useNotifications();
  const [respondingId, setRespondingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const goToRelated = (n: AppNotification) => {
    if (!n.isRead) markRead(n.id).catch(() => undefined);
    if (!user) return;

    if (n.type === "new_message" && n.data.conversationId) {
      onClose();
      const conversationId = n.data.conversationId;
      if (user.role === "homeowner") {
        router.push(`/homeowner/messages/${conversationId}` as never);
      } else if (user.role === "contractor" || user.role === "worker") {
        router.push(`/${user.role}/chat/${conversationId}` as never);
      }
      return;
    }

    // Material workflow: open the request (homeowner/contractor) or the supplier's own order.
    const materialRequestId = n.data.materialRequestId;
    if (materialRequestId) {
      onClose();
      if (user.role === "supplier") {
        router.push(`/supplier/orders${n.data.supplierOrderId ? `?orderId=${n.data.supplierOrderId}` : ""}` as never);
      } else if (user.role === "homeowner") {
        router.push(`/homeowner/approvals/${materialRequestId}` as never);
      } else if (user.role === "contractor") {
        router.push(`/contractor/material-request/${materialRequestId}` as never);
      }
      return;
    }

    const projectId = n.data.projectId;
    if (!projectId) return;
    onClose();
    if (user.role === "homeowner") {
      router.push(`/homeowner?projectId=${projectId}` as never);
    } else if (user.role === "worker") {
      router.push(`/worker/assignments?projectId=${projectId}` as never);
    } else if (user.role === "contractor") {
      router.push(`/contractor/projects?projectId=${projectId}` as never);
    }
  };

  const handleRespond = async (n: AppNotification, accept: boolean) => {
    const requestId = n.data.requestId;
    if (!requestId) return;
    setRespondingId(n.id);
    setError(null);
    try {
      await respond(requestId, accept, CONTRACTOR_TYPES.includes(n.type) ? "contractor" : "worker");
      await markRead(n.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to respond. Please try again.");
    } finally {
      setRespondingId(null);
    }
  };

  const handleDelete = async (n: AppNotification) => {
    setDeletingId(n.id);
    setError(null);
    try {
      await remove(n.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete notification. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Sheet
      visible={visible}
      title="Notifications"
      subtitle={notifications.length ? undefined : "You're all caught up."}
      onClose={onClose}
    >
      {error && <Text className="text-xs text-danger">{error}</Text>}

      {notifications.length > 0 && (
        <Pressable onPress={() => markAllRead().catch(() => undefined)} className="self-end">
          <Text className="text-xs font-semibold text-primary">Mark all read</Text>
        </Pressable>
      )}

      {loading && notifications.length === 0 ? (
        <View className="items-center py-6">
          <ActivityIndicator color="#f59e0b" />
        </View>
      ) : null}

      {!loading && notifications.length === 0 ? (
        <View className="items-center py-8">
          <Ionicons name="notifications-off-outline" size={28} color={chrome.mutedForeground} style={{ marginBottom: 8 }} />
          <Text className="text-sm text-muted-foreground">No notifications yet.</Text>
        </View>
      ) : null}

      <View style={{ gap: 10 }}>
        {notifications.map((n) => {
          const actionable =
            ACTIONABLE.includes(n.type) && !!n.data.requestId && (!n.data.requestStatus || n.data.requestStatus === "pending");
          const isInvite = INVITE_TYPES.includes(n.type);
          return (
            <Pressable
              key={n.id}
              onPress={() => goToRelated(n)}
              className="p-3 rounded-xl"
              style={{
                backgroundColor: n.isRead ? "transparent" : "#f59e0b12",
                borderWidth: 1,
                borderColor: n.isRead ? chrome.border : "#f59e0b30",
                opacity: deletingId === n.id ? 0.5 : 1,
              }}
            >
              <View className="flex-row items-start gap-2.5">
                <Ionicons name={ICON[n.type]} size={16} color={n.isRead ? chrome.mutedForeground : "#f59e0b"} style={{ marginTop: 1 }} />
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-foreground">{n.title}</Text>
                  <Text className="text-xs mt-0.5 text-muted-foreground">{n.body}</Text>
                  <Text className="text-xs mt-1 text-muted-foreground">{timeAgo(n.createdAt)}</Text>
                </View>
                {!n.isRead && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#f59e0b", marginTop: 4 }} />}
                <Pressable
                  onPress={() => handleDelete(n)}
                  disabled={deletingId === n.id}
                  hitSlop={8}
                  style={{ padding: 2, marginTop: -1 }}
                >
                  {deletingId === n.id ? (
                    <ActivityIndicator size="small" color={chrome.mutedForeground} />
                  ) : (
                    <Ionicons name="trash-outline" size={15} color="#ef4444" />
                  )}
                </Pressable>
              </View>

              {actionable && (
                <View className="flex-row gap-2 mt-3">
                  <Pressable
                    onPress={() => handleRespond(n, true)}
                    disabled={respondingId === n.id}
                    className="flex-1 py-2 rounded-lg items-center bg-primary"
                    style={{ opacity: respondingId === n.id ? 0.6 : 1 }}
                  >
                    {respondingId === n.id ? (
                      <ActivityIndicator size="small" color="#0f1117" />
                    ) : (
                      <Text className="text-xs font-bold text-primary-foreground">{isInvite ? "Accept" : "Approve"}</Text>
                    )}
                  </Pressable>
                  <Pressable
                    onPress={() => handleRespond(n, false)}
                    disabled={respondingId === n.id}
                    className="flex-1 py-2 rounded-lg items-center bg-muted border border-border"
                    style={{ opacity: respondingId === n.id ? 0.6 : 1 }}
                  >
                    <Text className="text-xs font-semibold text-muted-foreground">{isInvite ? "Decline" : "Reject"}</Text>
                  </Pressable>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
}
