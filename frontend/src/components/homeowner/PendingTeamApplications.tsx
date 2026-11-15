import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useNotifications } from "@/context/NotificationContext";
import { useTheme } from "@/context/ThemeContext";
import { ProfileAvatar } from "@/components/ProfilePhoto";
import Sheet from "@/components/Sheet";
import TeamProfileDetails from "@/components/homeowner/TeamProfileDetails";
import { Action, WorkersSectionTitle } from "@/components/homeowner/WorkersTabUI";
import type { AppNotification } from "@/types/notification";

/** The same live-checked applications and respond() actions used by the notification bell. */
export default function PendingTeamApplications({ projectId, onChanged }: { projectId: number; onChanged: () => Promise<void> }) {
  const { notifications, respond, markRead, refresh } = useNotifications();
  const { chrome } = useTheme();
  const [resolved, setResolved] = useState<string[]>([]);
  const [busy, setBusy] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<AppNotification | null>(null);
  const [profile, setProfile] = useState<{ id: number; name: string; role: "worker" | "contractor" } | null>(null);
  const locks = useRef(new Set<string>());
  const resolvedKeys = useRef(new Set<string>());
  const identity = useRef<number | null>(projectId);
  useEffect(() => { identity.current = projectId; return () => { identity.current = null; }; }, [projectId]);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));
  const kind = (notification: AppNotification) => notification.type === "worker_application" ? "worker" as const : "contractor" as const;
  const keyOf = (notification: AppNotification) => `${kind(notification)}:${notification.data.requestId}`;
  const seen = new Set<string>();
  const applications = notifications.filter(notification => {
    if (!["worker_application", "contractor_application"].includes(notification.type) || notification.data.projectId !== projectId || notification.data.requestStatus !== "pending" || !Number.isSafeInteger(notification.data.requestId) || notification.data.requestId! < 1) return false;
    const key = keyOf(notification);
    if (resolved.includes(key) || seen.has(key)) return false;
    seen.add(key); return true;
  });
  const answer = async (notification: AppNotification, accept: boolean) => {
    const key = keyOf(notification);
    if (identity.current !== projectId || locks.current.has(key) || resolvedKeys.current.has(key)) return;
    locks.current.add(key); setBusy(current => [...current, key]); setError(null);
    try {
      await respond(notification.data.requestId!, accept, kind(notification));
      if (identity.current !== projectId) return;
      resolvedKeys.current.add(key);
      setResolved(current => [...current, key]); setDetails(null);
      // Read status is cosmetic; a read error must not undo an accepted application.
      void markRead(notification.id).catch(() => undefined);
      await onChanged();
    } catch (failure) {
      if (identity.current === projectId) setError(failure instanceof Error ? failure.message : "Could not respond to this application. Please retry.");
    } finally {
      locks.current.delete(key);
      if (identity.current === projectId) setBusy(current => current.filter(value => value !== key));
    }
  };
  const nameOf = (notification: AppNotification) => kind(notification) === "worker" ? notification.data.workerName ?? "Skilled worker application" : notification.data.contractorName ?? "Contractor application";
  const photoOf = (notification: AppNotification) => (notifications.find(current => current.id === notification.id) ?? notification).data.applicantPhotoUrl;
  const decisionActions = (notification: AppNotification) => <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
    <Action label={busy.includes(keyOf(notification)) ? "Saving…" : "Approve"} filled disabled={busy.includes(keyOf(notification))} onPress={() => void answer(notification, true)} />
    <Action label="Reject" disabled={busy.includes(keyOf(notification))} onPress={() => void answer(notification, false)} />
  </View>;
  if (!applications.length && !error) return null;
  return <View style={{ gap: 9 }}>
    <WorkersSectionTitle>Pending Applications{applications.length > 0 ? ` (${applications.length})` : ""}</WorkersSectionTitle>
    {error && <Text accessibilityRole="alert" style={{ color: "#ef4444", fontSize: 12 }}>{error}</Text>}
    {applications.map(notification => <View key={keyOf(notification)} style={{ backgroundColor: chrome.card, borderColor: chrome.border, borderWidth: 1, borderRadius: 16, padding: 12, gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <ProfileAvatar name={nameOf(notification)} url={photoOf(notification)} size={38} />
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}><Text style={{ color: chrome.foreground, fontSize: 14, fontWeight: "700" }}>{nameOf(notification)}</Text><Text style={{ color: chrome.secondaryForeground, fontSize: 11 }}>{kind(notification) === "worker" ? "Skilled Worker" : "Contractor"} · Pending</Text></View>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
        <Action label="Application Details" onPress={() => setDetails(notification)} />{decisionActions(notification)}
      </View>
    </View>)}
    <Sheet visible={!!details} title="Application Details" onClose={() => setDetails(null)}>
      {details && <>
        <ProfileAvatar name={nameOf(details)} url={photoOf(details)} size={48} />
        <Text style={{ color: chrome.foreground, fontSize: 17, fontWeight: "800" }}>{nameOf(details)}</Text>
        <Text style={{ color: chrome.secondaryForeground, fontSize: 12 }}>{details.data.projectTitle}</Text>
        <Text style={{ color: chrome.foreground, fontSize: 13, lineHeight: 21 }}>{details.body}</Text>
        <Text style={{ color: chrome.secondaryForeground, fontSize: 11 }}>{details.createdAt}</Text>
        {!!(details.data.workerId ?? details.data.contractorId) && <Pressable accessibilityRole="button" onPress={() => {
          setProfile({ id: (details.data.workerId ?? details.data.contractorId)!, name: nameOf(details), role: kind(details) }); setDetails(null);
        }} style={{ paddingVertical: 10 }}><Text style={{ color: chrome.foreground, fontSize: 13, fontWeight: "700" }}>View Profile</Text></Pressable>}
        {decisionActions(details)}
      </>}
    </Sheet>
    {profile && <TeamProfileDetails key={`${profile.role}-${profile.id}`} member={profile} onClose={() => setProfile(null)} />}
  </View>;
}
