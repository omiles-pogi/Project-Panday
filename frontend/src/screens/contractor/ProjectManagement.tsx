import { useState } from "react";
import { Text, View, Pressable, ActivityIndicator } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { CountUp } from "@/components/charts";
import { Badge, Card, PageHeader, Screen } from "@/components/ui";
import MessageButton from "@/components/MessageButton";
import { ROLE_FLOATING_TAB_BAR_CLEARANCE } from "@/components/RoleFloatingTabBar";
import ProjectChecklistCard from "@/components/ProjectChecklistCard";
import ProjectStatusBanner from "@/components/ProjectStatusBanner";
import TeamActivity from "@/components/TeamActivity";
import { fetchMyProjects, setTeamWage } from "@/services/api/projects";
import { projectStatusMeta } from "@/utils/projectStatus";
import { createMaterialRequest } from "@/services/api/materialRequests";
import WageSheet from "@/components/WageSheet";
import type { MyProject, Wage, WageInput } from "@/types/project";
import { peso } from "@/utils/currency";
import { wageLine } from "@/utils/wage";
import { useFocusedResource } from "@/hooks/useFocusedResource";

/** Starts a draft material request for this project and opens it in the editor. */
function CreateMaterialRequestButton({ projectId }: { projectId: number }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    createMaterialRequest(projectId)
      .then((r) => router.push(`/contractor/material-request/${r.id}` as never))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not create the request."))
      .finally(() => setBusy(false));
  };

  return (
    <View style={{ gap: 4 }}>
      <Pressable onPress={create} className="flex-row items-center gap-1.5 px-4 py-2.5 rounded-xl" style={{ backgroundColor: "#f59e0b20" }}>
        {busy ? <ActivityIndicator size="small" color="#f59e0b" /> : <Ionicons name="clipboard-outline" size={16} color="#f59e0b" />}
        <Text className="text-xs font-semibold" style={{ color: "#f59e0b" }}>
          Create Material Request
        </Text>
      </Pressable>
      {error && <Text className="text-xs text-danger">{error}</Text>}
    </View>
  );
}

function ProjectCard({
  project,
  onChanged,
  initiallyExpanded,
}: {
  project: MyProject;
  onChanged: () => Promise<void>;
  initiallyExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(!!initiallyExpanded);
  // The worker whose wage is being set, if any.
  const [wageTarget, setWageTarget] = useState<{ id: number; name: string; wage: Wage | null | undefined; minDailyWage?: number | null } | null>(null);

  const saveWage = async (input: WageInput) => {
    if (!wageTarget) return;
    await setTeamWage(project.id, "worker", wageTarget.id, input);
    onChanged();
  };

  return (
    <Card>
      <Pressable onPress={() => setExpanded((e) => !e)}>
        <View className="flex-row items-start justify-between mb-2">
          <View className="flex-1 pr-3" style={{ gap: 4 }}>
            <Text className="font-bold text-sm text-foreground">{project.title}</Text>
            <Badge label={projectStatusMeta(project.status).label} color={projectStatusMeta(project.status).color} />
            <Text className="text-xs text-muted-foreground">
              Homeowner: {project.ownerName}
              {project.location ? ` · ${project.location}` : ""}
            </Text>
          </View>
          <View className="items-end">
            <Text className="text-xl font-bold" style={{ color: "#f59e0b" }}>
              {project.overallProgressPct}%
            </Text>
            <Text className="text-xs text-muted-foreground">Progress</Text>
          </View>
        </View>
        <View className="flex-row flex-wrap gap-2 mb-2">
          <View className="p-2.5 rounded-xl bg-muted" style={{ flexGrow: 1, flexBasis: "45%" }}>
            <Text className="text-xs mb-0.5 text-muted-foreground">Budget</Text>
            <CountUp text={peso(project.budget)} className="text-xs font-medium text-foreground" />
          </View>
          <View className="p-2.5 rounded-xl bg-muted" style={{ flexGrow: 1, flexBasis: "45%" }}>
            <Text className="text-xs mb-0.5 text-muted-foreground">AI Estimate</Text>
            <CountUp text={peso(project.totalEstimate)} className="text-xs font-medium text-foreground" />
          </View>
        </View>
        <View className="flex-row items-center justify-center gap-1 py-1">
          <Text className="text-xs font-medium text-primary">{expanded ? "Hide checklist" : "Manage checklist"}</Text>
          <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={14} color="#f59e0b" />
        </View>
      </Pressable>

      <View className="mt-2">
        <ProjectStatusBanner project={project} />
      </View>

      <View className="mt-2 flex-row flex-wrap gap-2">
        <MessageButton projectId={project.id} chatPath={(id) => `/contractor/chat/${id}`} label="Message Homeowner" />
        {project.workers.map((worker) => (
          <MessageButton
            key={worker.id}
            projectId={project.id}
            workerId={worker.id}
            chatPath={(id) => `/contractor/chat/${id}`}
            label={`Message ${worker.name}`}
          />
        ))}
        <CreateMaterialRequestButton projectId={project.id} />
      </View>

      {(project.myWage || project.workers.length > 0) && (
        <View className="mt-3" style={{ gap: 6 }}>
          <Text className="text-xs font-bold text-foreground">Wages</Text>
          <Text className="text-xs leading-5 text-muted-foreground">Worker wages are calculated automatically when they join. Custom amounts are optional.</Text>
          <View className="flex-row items-center justify-between px-3 py-2 rounded-xl bg-muted">
            <Text className="text-xs font-medium text-foreground">Your fee</Text>
            <Text className="text-xs font-semibold" style={{ color: project.myWage ? "#10b981" : "#6b7280" }}>
              {project.myWage ? wageLine(project.myWage) : "Not set — agreed with the homeowner"}
            </Text>
          </View>
          {project.workers.map((worker) => (
            <View key={worker.id} className="flex-row items-center gap-2 px-3 py-2 rounded-xl bg-muted">
              <View className="flex-1">
                <Text className="text-xs font-medium text-foreground">{worker.name}</Text>
                <Text className="text-xs" style={{ color: worker.wage ? "#10b981" : "#6b7280" }}>
                  {wageLine(worker.wage)}
                </Text>
                {worker.minDailyWage != null && (
                  <Text className="text-xs text-muted-foreground">Asks from {peso(worker.minDailyWage)}/day</Text>
                )}
              </View>
              {project.canManageChecklist && (
                <Pressable
                  onPress={() => setWageTarget({ id: worker.id, name: worker.name, wage: worker.wage, minDailyWage: worker.minDailyWage })}
                  hitSlop={6}
                  className="px-2.5 py-1.5 rounded-lg"
                  style={{ backgroundColor: "#f59e0b20" }}
                >
                  <Text className="text-xs font-semibold" style={{ color: "#f59e0b" }}>
                    {worker.wage ? "Wage options" : "Auto wage"}
                  </Text>
                </Pressable>
              )}
            </View>
          ))}
        </View>
      )}

      {wageTarget && (
        <WageSheet
          name={wageTarget.name}
          current={wageTarget.wage}
          defaultUnit="per_day"
          minDailyWage={wageTarget.minDailyWage}
          onClose={() => setWageTarget(null)}
          onSave={saveWage}
        />
      )}

      {expanded && (
        <View style={{ gap: 10 }} className="mt-2">
          {project.workers.length > 0 && (
            <View style={{ gap: 6 }}>
              <Text className="text-xs font-bold text-foreground">Team on site</Text>
              <TeamActivity projectId={project.id} />
            </View>
          )}

          {/* Checklist progress across every phase; "Mark Project as Finished" once it's all done. */}
          <ProjectChecklistCard project={project} onChanged={onChanged} />
        </View>
      )}
    </Card>
  );
}

export default function ProjectManagement() {
  // Set when arriving from a specific project elsewhere (e.g. tapping it on the Dashboard) —
  // that project's checklist opens pre-expanded instead of landing on the flat, collapsed list.
  const { projectId } = useLocalSearchParams<{ projectId?: string }>();
  const targetId = projectId ? Number(projectId) : null;
  const { data: projects, error, refresh: load } = useFocusedResource(fetchMyProjects);

  return (
    <Screen extraBottomPadding={ROLE_FLOATING_TAB_BAR_CLEARANCE}>
      <PageHeader title="My Projects" subtitle="Projects you're assigned to. Check off work as it's completed." />
      <Pressable accessibilityRole="button" onPress={load} className="self-start flex-row items-center gap-1.5">
        <Ionicons name="refresh-outline" size={14} color="#f59e0b" />
        <Text className="text-xs text-muted-foreground">Refresh progress · updates every 15 seconds</Text>
      </Pressable>

      {error && <Text className="text-xs text-danger px-1">{error}</Text>}

      {!error && projects === null && (
        <View className="items-center py-10">
          <ActivityIndicator color="#f59e0b" />
        </View>
      )}

      {projects !== null && projects.length === 0 && (
        <Text className="text-sm text-center text-muted-foreground py-10">
          No homeowner has added you to a project yet.
        </Text>
      )}

      {projects?.map((project) => (
        <ProjectCard key={project.id} project={project} onChanged={load} initiallyExpanded={project.id === targetId} />
      ))}
    </Screen>
  );
}
