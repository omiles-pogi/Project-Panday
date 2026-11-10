import { useState } from "react";
import { Text, View, Pressable, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Sheet from "@/components/Sheet";
import { Badge, type IconName } from "@/components/ui";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import { useTheme } from "@/context/ThemeContext";
import { useNotifications } from "@/context/NotificationContext";
import { useAuth } from "@/context/AuthContext";
import type { AppNotification, NotificationType, RequestStatus } from "@/types/notification";
import { notificationRoute } from "@/utils/notificationRoutes";

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export const ICON: Record<NotificationType, IconName> = {
  new_message: "chatbubble-ellipses-outline",
  wage_set: "cash-outline",
  materials_reviewed: "clipboard-outline",
  material_request_auto_approved: "flash-outline",
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
  supplier_fulfillment_received: "cube-outline",
  supplier_fulfillment_confirmed: "checkmark-circle-outline",
  supplier_price_confirmation: "pricetag-outline",
  supplier_fulfillment_unavailable: "alert-circle-outline",
  supplier_fulfillment_cancelled: "close-circle-outline",
  supplier_fulfillment_received_by_contractor: "checkmark-done-outline",
  rating_received: "star-outline",
  schedule_delay: "warning-outline",
  project_completion_submitted: "flag-outline",
  project_completion_confirmed: "checkmark-done-circle-outline",
  project_corrections_requested: "construct-outline",
  quote_request_received: "pricetags-outline",
  quote_bid_received: "pricetag-outline",
  quote_bid_awarded: "trophy-outline",
  quote_bid_not_selected: "close-circle-outline",
  quote_request_cancelled: "close-circle-outline",
};

// Only these carry a pending request that this viewer can act on directly from the panel.
const ACTIONABLE: NotificationType[] = ["worker_invite", "worker_application", "contractor_invite", "contractor_application"];
const INVITE_TYPES: NotificationType[] = ["worker_invite", "contractor_invite"];
const INVITE_STATUS_META: Record<RequestStatus, { label: string; color: string }> = {
  pending: { label: "Pending", color: "#f59e0b" },
  approved: { label: "Accepted", color: "#10b981" },
  rejected: { label: "Declined", color: "#ef4444" },
};
const CONTRACTOR_TYPES: NotificationType[] = [
  "contractor_invite",
  "contractor_invite_response",
  "contractor_application",
  "contractor_application_decision",
];

/** A small tinted pill for the actions above the list. */
function ToolbarButton({
  label,
  icon,
  color,
  onPress,
  disabled,
  busy,
}: {
  label: string;
  icon: IconName;
  color: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="flex-row items-center justify-center rounded-full"
      style={{ gap: 6, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: `${color}1a`, opacity: disabled ? 0.45 : 1 }}
    >
      {busy ? <ActivityIndicator size="small" color={color} /> : <Ionicons name={icon} size={14} color={color} />}
      <Text className="text-xs font-semibold" style={{ color }}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function NotificationsPanel({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { chrome } = useTheme();
  const { user } = useAuth();
  const { notifications, unreadCount, loading, markRead, markAllRead, remove, clearAll, respond } = useNotifications();
  const [respondingId, setRespondingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { ask, dialog } = useConfirmDialog();

  // Invites and applications still waiting for an answer aren't cleared — they're the only place to answer them.
  const waitingForAnswer = notifications.filter(
    (n) => ACTIONABLE.includes(n.type) && !!n.data.requestId && (!n.data.requestStatus || n.data.requestStatus === "pending")
  ).length;

  const confirmClearAll = () =>
    ask({
      title: "Clear all notifications?",
      detail: `${notifications.length} ${notifications.length === 1 ? "notification" : "notifications"}`,
      message:
        waitingForAnswer > 0
          ? `This removes your notifications for good. ${waitingForAnswer === 1 ? "The invite or application" : `The ${waitingForAnswer} invites and applications`} you haven't answered yet will stay so you can respond.`
          : "This removes all of your notifications for good.",
      confirmLabel: "Clear all",
      icon: "trash-outline",
      mood: "thinking",
      tone: "danger",
      onConfirm: () => void handleClearAll(),
    });

  const handleClearAll = async () => {
    if (clearing) return;
    setClearing(true);
    setError(null);
    try {
      await clearAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear notifications. Please try again.");
    } finally {
      setClearing(false);
    }
  };

  const goToRelated = (n: AppNotification) => {
    if (!n.isRead) markRead(n.id).catch(() => undefined);
    if (!user) return;
    const route = notificationRoute(n, user.role);
    if (!route) return;
    onClose();
    router.push(route as never);
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
        <View className="flex-row flex-wrap items-center justify-between" style={{ gap: 10 }}>
          <Text className="text-xs font-medium text-muted-foreground">{unreadCount > 0 ? `${unreadCount} unread` : "All read"}</Text>
          <View className="flex-row" style={{ gap: 8 }}>
            <ToolbarButton
              label="Mark all read"
              icon="checkmark-done-outline"
              color="#f59e0b"
              disabled={unreadCount === 0}
              onPress={() => markAllRead().catch(() => undefined)}
            />
            <ToolbarButton label="Clear all" icon="trash-outline" color="#ef4444" busy={clearing} onPress={confirmClearAll} />
          </View>
        </View>
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
          const isInvite = INVITE_TYPES.includes(n.type);
          // Invites get a "view project details" button instead of inline Accept/Decline — only
          // applications (approve/reject) still act directly from the panel.
          const actionable =
            ACTIONABLE.includes(n.type) && !isInvite && !!n.data.requestId && (!n.data.requestStatus || n.data.requestStatus === "pending");
          const inviteStatus: RequestStatus = n.data.requestStatus ?? "pending";
          const invitePath = isInvite && n.data.requestId && user ? notificationRoute(n, user.role) : null;
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
                      <Text className="text-xs font-bold text-primary-foreground">Approve</Text>
                    )}
                  </Pressable>
                  <Pressable
                    onPress={() => handleRespond(n, false)}
                    disabled={respondingId === n.id}
                    className="flex-1 py-2 rounded-lg items-center bg-muted border border-border"
                    style={{ opacity: respondingId === n.id ? 0.6 : 1 }}
                  >
                    <Text className="text-xs font-semibold text-muted-foreground">Reject</Text>
                  </Pressable>
                </View>
              )}

              {isInvite && invitePath && (
                <View className="flex-row items-center justify-between gap-2 mt-3">
                  {inviteStatus !== "pending" && <Badge label={INVITE_STATUS_META[inviteStatus].label} color={INVITE_STATUS_META[inviteStatus].color} />}
                  <Pressable
                    onPress={() => {
                      markRead(n.id).catch(() => undefined);
                      onClose();
                      router.push(invitePath as never);
                    }}
                    className="py-2 px-4 rounded-lg items-center bg-primary"
                    style={{ marginLeft: inviteStatus !== "pending" ? 0 : "auto" }}
                  >
                    <Text className="text-xs font-bold text-primary-foreground">
                      {inviteStatus === "pending" ? "View project details" : "View project"}
                    </Text>
                  </Pressable>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      {dialog}
    </Sheet>
  );
}
