import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Badge, Card } from "@/components/ui";
import { useTheme } from "@/context/ThemeContext";
import { useFocusedResource } from "@/hooks/useFocusedResource";
import {
  fetchContractorRequestProject,
  fetchWorkerRequestProject,
  respondToContractorRequest,
  respondToWorkerRequest,
} from "@/services/api/projects";
import type { ContractorInviteDetails, RequestStatus, WorkerInviteDetails } from "@/types/notification";
import { peso } from "@/utils/currency";
import { timelineLabel } from "@/utils/timeline";

type Role = "worker" | "contractor";

const STATUS_META: Record<RequestStatus, { label: string; color: string }> = {
  pending: { label: "Pending", color: "#f59e0b" },
  approved: { label: "Accepted", color: "#10b981" },
  rejected: { label: "Declined", color: "#ef4444" },
};

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/**
 * What a worker/contractor sees before deciding on a team invite: the homeowner's project, read
 * from the invite's own project-details endpoint (not the richer owner/team view — budget
 * breakdown, wages, checklist etc. aren't theirs to see until they're actually on the team).
 */
export default function ProjectInviteDetails({ role, requestId }: { role: Role; requestId: number }) {
  const { chrome } = useTheme();
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(
    () => (role === "worker" ? fetchWorkerRequestProject(requestId) : fetchContractorRequestProject(requestId)),
    [role, requestId]
  );
  const { data, error, loading, refresh } = useFocusedResource<WorkerInviteDetails | ContractorInviteDetails>(load);

  const respond = async (accept: boolean) => {
    if (busy) return;
    setBusy(accept ? "accept" : "decline");
    setActionError(null);
    try {
      if (role === "worker") await respondToWorkerRequest(requestId, accept);
      else await respondToContractorRequest(requestId, accept);
      if (accept) await refresh();
      else router.back();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not respond. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  if (loading && !data) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#f59e0b" />
      </View>
    );
  }

  if (error && !data) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-8">
        <Ionicons name="warning-outline" size={28} color="#ef4444" style={{ marginBottom: 8 }} />
        <Text className="text-sm text-center text-muted-foreground">{error}</Text>
      </View>
    );
  }

  if (!data) return null;

  const { request, project } = data;
  const status = STATUS_META[request.status];
  const team = [
    ...project.contractors.map((c) => ({ ...c, role: c.specialization ?? "Contractor" })),
    ...project.workers.map((w) => ({ ...w, role: w.trade ?? "Worker" })),
  ];

  return (
    <View className="flex-1 bg-background">
      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingVertical: 16, gap: 14 }}>
        <View className="flex-row items-center justify-between">
          <Badge label={status.label} color={status.color} />
          <Text className="text-xs text-muted-foreground">Sent {timeAgo(request.createdAt)}</Text>
        </View>

        <View>
          <Text className="text-xl font-extrabold text-foreground">{project.title}</Text>
          {project.location && <Text className="text-sm mt-1 text-muted-foreground">{project.location}</Text>}
        </View>

        <Card>
          <View className="flex-row items-center gap-3">
            <View className="w-10 h-10 rounded-full items-center justify-center" style={{ backgroundColor: "#f59e0b20" }}>
              <Text className="text-sm font-bold" style={{ color: "#f59e0b" }}>
                {project.homeowner.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View>
              <Text className="text-xs text-muted-foreground">Homeowner</Text>
              <Text className="text-sm font-semibold text-foreground">{project.homeowner.name}</Text>
            </View>
          </View>
        </Card>

        {(project.exteriorConcept || project.interiorConcept) && (
          <Card title="About This Project">
            <View style={{ gap: 10 }}>
              {project.exteriorConcept && (
                <View>
                  <Text className="text-xs font-semibold text-foreground mb-1">Exterior</Text>
                  <Text className="text-xs leading-5 text-muted-foreground">{project.exteriorConcept}</Text>
                </View>
              )}
              {project.interiorConcept && (
                <View>
                  <Text className="text-xs font-semibold text-foreground mb-1">Interior</Text>
                  <Text className="text-xs leading-5 text-muted-foreground">{project.interiorConcept}</Text>
                </View>
              )}
            </View>
          </Card>
        )}

        {(project.designStyle || project.areaSqm || project.bedrooms || project.bathrooms) && (
          <Card title="Design & Scope">
            <View style={{ gap: 10 }}>
              {project.designStyle && (
                <View className="flex-row justify-between">
                  <Text className="text-xs text-muted-foreground">Style</Text>
                  <Text className="text-xs font-semibold text-foreground">{project.designStyle}</Text>
                </View>
              )}
              {!!project.areaSqm && (
                <View className="flex-row justify-between">
                  <Text className="text-xs text-muted-foreground">Floor area</Text>
                  <Text className="text-xs font-semibold text-foreground">{project.areaSqm} sqm</Text>
                </View>
              )}
              {!!project.floors && (
                <View className="flex-row justify-between">
                  <Text className="text-xs text-muted-foreground">Floors</Text>
                  <Text className="text-xs font-semibold text-foreground">{project.floors}</Text>
                </View>
              )}
              {!!(project.bedrooms || project.bathrooms) && (
                <View className="flex-row justify-between">
                  <Text className="text-xs text-muted-foreground">Bedrooms / Bathrooms</Text>
                  <Text className="text-xs font-semibold text-foreground">{project.bedrooms ?? 0} / {project.bathrooms ?? 0}</Text>
                </View>
              )}
              {project.garageCars != null && (
                <View className="flex-row justify-between">
                  <Text className="text-xs text-muted-foreground">Garage</Text>
                  <Text className="text-xs font-semibold text-foreground">{project.garageCars > 0 ? `${project.garageCars}-car garage` : "No garage"}</Text>
                </View>
              )}
            </View>
          </Card>
        )}

        <Card title="Project Details">
          <View style={{ gap: 10 }}>
            <View className="flex-row justify-between">
              <Text className="text-xs text-muted-foreground">Budget</Text>
              <Text className="text-xs font-semibold text-foreground">{project.budget > 0 ? peso(project.budget) : "Not set"}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-xs text-muted-foreground">AI cost estimate</Text>
              <Text className="text-xs font-semibold text-foreground">{peso(project.totalEstimate)}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-xs text-muted-foreground">Timeline</Text>
              <Text className="text-xs font-semibold text-foreground">{timelineLabel(project.timelineValue, project.timelineUnit)}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-xs text-muted-foreground">Started</Text>
              <Text className="text-xs font-semibold text-foreground">{new Date(project.startedAt).toLocaleDateString()}</Text>
            </View>
          </View>
        </Card>

        {team.length > 0 && (
          <Card title="Current Team">
            <View style={{ gap: 8 }}>
              {team.map((member) => (
                <View key={`${member.id}-${member.role}`} className="flex-row items-center justify-between">
                  <Text className="text-xs text-foreground">{member.name}</Text>
                  <Text className="text-xs text-muted-foreground">{member.role}</Text>
                </View>
              ))}
            </View>
          </Card>
        )}

        {actionError && <Text className="text-xs text-danger">{actionError}</Text>}
      </ScrollView>

      <View className="px-4 pt-3" style={{ paddingBottom: 24, borderTopWidth: 1, borderColor: chrome.border, gap: 8 }}>
        {request.status === "pending" ? (
          <View className="flex-row gap-3">
            <Pressable
              onPress={() => respond(false)}
              disabled={!!busy}
              className="flex-1 py-3 rounded-xl items-center bg-muted border border-border"
              style={{ opacity: busy ? 0.6 : 1 }}
            >
              {busy === "decline" ? (
                <ActivityIndicator size="small" color={chrome.mutedForeground} />
              ) : (
                <Text className="text-sm font-semibold text-muted-foreground">Decline</Text>
              )}
            </Pressable>
            <Pressable
              onPress={() => respond(true)}
              disabled={!!busy}
              className="flex-1 py-3 rounded-xl items-center bg-primary"
              style={{ opacity: busy ? 0.6 : 1 }}
            >
              {busy === "accept" ? (
                <ActivityIndicator size="small" color="#0f1117" />
              ) : (
                <Text className="text-sm font-bold text-primary-foreground">Accept Invite</Text>
              )}
            </Pressable>
          </View>
        ) : request.status === "approved" ? (
          <>
            <View className="flex-row items-center justify-center gap-1.5 py-1">
              <Ionicons name="checkmark-circle" size={16} color="#10b981" />
              <Text className="text-sm font-semibold" style={{ color: "#10b981" }}>
                You joined this project
              </Text>
            </View>
            <Pressable
              onPress={() => router.push((role === "worker" ? "/worker/assignments" : "/contractor/projects") as never)}
              className="py-3 rounded-xl items-center bg-primary"
            >
              <Text className="text-sm font-bold text-primary-foreground">Open Project</Text>
            </Pressable>
          </>
        ) : (
          <View className="flex-row items-center justify-center gap-1.5 py-2">
            <Ionicons name="close-circle" size={16} color="#ef4444" />
            <Text className="text-sm font-semibold" style={{ color: "#ef4444" }}>
              You declined this invite
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
