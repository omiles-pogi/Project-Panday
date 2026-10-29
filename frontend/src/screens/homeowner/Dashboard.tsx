import { useCallback, useRef, useState } from "react";
import { ScrollView, Text, View, Pressable, ActivityIndicator, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ProgressRing } from "@/components/charts";
import { ProgressBar } from "@/components/ui";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { deleteProject, fetchDashboard, fetchMyHomeownerProjects } from "@/services/api/projects";
import type { DashboardData, ProjectSummary } from "@/types/project";
import { peso } from "@/utils/currency";
import { compareBudget, formatBudget } from "@/utils/budget";
import { usePlan } from "@/context/PlanContext";
import Mascot from "@/components/Mascot";
import MessageButton from "@/components/MessageButton";

const QUICK_ACTIONS = [
  { label: "AI Plan", icon: "sparkles-outline", href: "/homeowner/project-chat" },
  { label: "Budget", icon: "wallet-outline", href: "/homeowner/budget-monitor" },
  { label: "Progress", icon: "stats-chart-outline", href: "/homeowner/progress" },
  { label: "Approvals", icon: "checkmark-circle-outline", href: "/homeowner/approvals" },
] as const;

function progressLabel(pct: number): { label: string; color: string } {
  if (pct >= 100) return { label: "COMPLETED", color: "#10b981" };
  if (pct > 0) return { label: "IN PROGRESS", color: "#f59e0b" };
  return { label: "JUST STARTED", color: "#9ca3af" };
}

/* DELETE CONFIRMATION — PandAi reacts (sad, bobbing) instead of a plain system alert, to match
 * the AI chat's own card styling (dark card, amber primary) rather than the OS's native dialog. */
function DeleteProjectModal({
  project,
  deleting,
  onCancel,
  onConfirm,
}: {
  project: ProjectSummary | null;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal visible={!!project} transparent animationType="fade" onRequestClose={onCancel}>
      <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: "rgba(0,0,0,0.65)" }}>
        <View className="w-full rounded-3xl p-6 items-center bg-card border border-border" style={{ maxWidth: 340 }}>
          <Mascot size={88} mood="sad" bob />
          <Text className="text-base font-extrabold mt-3 text-foreground">Delete this project?</Text>
          <Text className="text-xs text-center mt-2 leading-5 text-muted-foreground">
            <Text className="font-semibold text-foreground">{project?.title}</Text> will be permanently removed,
            including its budget, phases, and checklist. Contractors and workers assigned to it will lose access
            too. This can&apos;t be undone.
          </Text>
          <View className="flex-row gap-2 mt-5 w-full">
            <Pressable
              onPress={onCancel}
              disabled={deleting}
              className="flex-1 py-2.5 rounded-xl items-center bg-muted border border-border"
            >
              <Text className="text-sm font-semibold text-muted-foreground">Keep Project</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              disabled={deleting}
              className="flex-1 py-2.5 rounded-xl items-center flex-row justify-center gap-1.5 bg-danger"
              style={{ opacity: deleting ? 0.6 : 1 }}
            >
              {deleting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="trash-outline" size={14} color="#fff" />
                  <Text className="text-sm font-bold text-white">Delete</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* NEW PROJECT CONFIRMATION — only shown when there's an active AI conversation to discard;
 * starting fresh otherwise just navigates straight to the planner. */
function NewProjectModal({ visible, onCancel, onConfirm }: { visible: boolean; onCancel: () => void; onConfirm: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: "rgba(0,0,0,0.65)" }}>
        <View className="w-full rounded-3xl p-6 items-center bg-card border border-border" style={{ maxWidth: 340 }}>
          <Mascot size={88} mood="happy" bob />
          <Text className="text-base font-extrabold mt-3 text-foreground">Start a new project?</Text>
          <Text className="text-xs text-center mt-2 leading-5 text-muted-foreground">
            This clears your current AI conversation so PandAi can help you plan something new. Any project
            you&apos;ve already finalized stays saved on your dashboard.
          </Text>
          <View className="flex-row gap-2 mt-5 w-full">
            <Pressable onPress={onCancel} className="flex-1 py-2.5 rounded-xl items-center bg-muted border border-border">
              <Text className="text-sm font-semibold text-muted-foreground">Keep Planning</Text>
            </Pressable>
            <Pressable onPress={onConfirm} className="flex-1 py-2.5 rounded-xl items-center bg-primary">
              <Text className="text-sm font-bold text-primary-foreground">Start New</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* Fixed to the bottom-left of the screen (outside the ScrollView), so it stays in place while
 * the dashboard's content scrolls underneath it instead of scrolling away with it. */
function NewProjectFab({ onPress }: { onPress: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-1.5 rounded-full bg-primary"
      style={{
        position: "absolute",
        left: 16,
        bottom: insets.bottom + 16,
        paddingVertical: 12,
        paddingHorizontal: 18,
        elevation: 6,
        shadowColor: "#000",
        shadowOpacity: 0.25,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
        zIndex: 50,
      }}
    >
      <Ionicons name="add" size={18} color="#0f1117" />
      <Text className="text-sm font-bold text-primary-foreground">New Project</Text>
    </Pressable>
  );
}

export default function Dashboard() {
  const { plan, reset: resetPlan, selectProject: selectPlanProject } = usePlan();
  const [data, setData] = useState<DashboardData | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectSummary | null>(null);
  const [confirmNewProject, setConfirmNewProject] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Mirrors selectedProjectId but readable from inside the focus effect below without making it
  // re-run on every selection change — this is what lets returning to Home re-fetch whichever
  // project you'd picked, instead of the focus effect always defaulting back to the latest one.
  const selectedProjectIdRef = useRef<number | null>(null);
  // Set once, from a notification's "go to this project" deep link (?projectId=...) — consumed
  // on the first focus only, so switching projects manually afterward isn't overridden by it.
  const { projectId: deepLinkProjectId } = useLocalSearchParams<{ projectId?: string }>();
  const consumedDeepLink = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (!consumedDeepLink.current && deepLinkProjectId) {
        selectedProjectIdRef.current = Number(deepLinkProjectId);
        consumedDeepLink.current = true;
      }
      let cancelled = false;
      setLoading(true);
      setError(null);
      Promise.all([fetchDashboard(selectedProjectIdRef.current ?? undefined), fetchMyHomeownerProjects()])
        .then(([dashboard, list]) => {
          if (cancelled) return;
          setData(dashboard);
          setProjects(list);
          const id = dashboard.project?.id ?? null;
          setSelectedProjectId(id);
          selectedProjectIdRef.current = id;
          selectPlanProject(id);
        })
        .catch((err) => {
          if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load dashboard.");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const switchProject = useCallback((projectId: number) => {
    if (projectId === selectedProjectId) return;
    setSwitching(true);
    setSelectedProjectId(projectId);
    selectedProjectIdRef.current = projectId;
    selectPlanProject(projectId);
    fetchDashboard(projectId)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load project."))
      .finally(() => setSwitching(false));
  }, [selectedProjectId, selectPlanProject]);

  const handleDelete = useCallback(
    (projectId: number) => {
      setDeletingId(projectId);
      deleteProject(projectId)
        .then(() => {
          const remaining = projects.filter((p) => p.id !== projectId);
          setProjects(remaining);
          if (projectId !== selectedProjectId) return undefined;

          const next = remaining[0]?.id;
          setSelectedProjectId(next ?? null);
          selectedProjectIdRef.current = next ?? null;
          selectPlanProject(next ?? null);
          return fetchDashboard(next).then(setData);
        })
        .catch((err) => setError(err instanceof Error ? err.message : "Failed to delete project."))
        .finally(() => {
          setDeletingId(null);
          setDeleteTarget(null);
        });
    },
    [projects, selectedProjectId, selectPlanProject]
  );

  const handleNewProject = useCallback(() => {
    if (plan) {
      setConfirmNewProject(true);
    } else {
      router.push("/homeowner/project-chat" as never);
    }
  }, [plan]);

  const confirmNewProjectAction = useCallback(() => {
    resetPlan();
    setConfirmNewProject(false);
    router.push("/homeowner/project-chat" as never);
  }, [resetPlan]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#f59e0b" />
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-8">
        <Ionicons name="warning-outline" size={28} color="#ef4444" style={{ marginBottom: 8 }} />
        <Text className="text-sm text-center text-muted-foreground">{error}</Text>
      </View>
    );
  }

  const project = data?.project ?? null;

  // Always shown (even with just one project), styled like browser tabs — compact, with
  // their own close "x" — so there's always an obvious, consistent place to delete from.
  const picker = projects.length > 0 && (
    <View>
      <Text className="text-xs font-semibold mb-2 text-muted-foreground">YOUR PROJECTS</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {projects.map((p) => {
          const active = p.id === selectedProjectId;
          const isDeleting = deletingId === p.id;
          return (
            <View
              key={p.id}
              className="flex-row items-center rounded-lg border"
              style={{
                backgroundColor: active ? "#f59e0b20" : "#1a1d27",
                borderColor: active ? "#f59e0b50" : "#2a2f42",
                opacity: isDeleting ? 0.5 : 1,
              }}
            >
              <Pressable
                onPress={() => switchProject(p.id)}
                disabled={switching || isDeleting}
                className="flex-row items-center gap-1.5 py-2 pl-3 pr-1.5"
                style={{ maxWidth: 140 }}
              >
                {active && <Ionicons name="checkmark-circle" size={12} color="#f59e0b" />}
                <Text
                  className="text-xs font-semibold"
                  style={{ color: active ? "#f59e0b" : "#9ca3af" }}
                  numberOfLines={1}
                >
                  {p.title}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setDeleteTarget(p)}
                disabled={isDeleting}
                hitSlop={8}
                className="py-2 pl-1 pr-2.5"
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#6b7280" />
                ) : (
                  <Ionicons name="close" size={14} color="#6b7280" />
                )}
              </Pressable>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );

  const deleteModal = (
    <DeleteProjectModal
      project={deleteTarget}
      deleting={deletingId === deleteTarget?.id}
      onCancel={() => setDeleteTarget(null)}
      onConfirm={() => deleteTarget && handleDelete(deleteTarget.id)}
    />
  );

  const newProjectModal = (
    <NewProjectModal
      visible={confirmNewProject}
      onCancel={() => setConfirmNewProject(false)}
      onConfirm={confirmNewProjectAction}
    />
  );

  if (!project) {
    return (
      <>
        <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 16, paddingBottom: 96, gap: 16 }}>
          {picker}
          <View className="rounded-3xl p-6 items-center bg-card border border-border">
            <Ionicons name="sparkles-outline" size={28} color="#f59e0b" style={{ marginBottom: 8 }} />
            <Text className="font-bold text-base mb-1 text-foreground">No active project yet</Text>
            <Text className="text-sm text-center mb-4 text-muted-foreground">
              Describe your project to the AI planner and approve the generated plan to see it here.
            </Text>
            <Pressable
              onPress={() => router.push("/homeowner/project-chat" as never)}
              className="px-5 py-2.5 rounded-xl bg-primary"
            >
              <Text className="font-bold text-sm text-primary-foreground">Start AI Plan</Text>
            </Pressable>
          </View>
          <View className="flex-row flex-wrap gap-2">
            {QUICK_ACTIONS.map(({ label, icon, href }) => (
              <Pressable
                key={href}
                onPress={() => router.push(href as never)}
                className="items-center gap-1.5 py-3.5 rounded-2xl bg-card border border-border"
                style={{ width: "23%" }}
              >
                <Ionicons name={icon} size={22} color="#f59e0b" />
                <Text className="text-xs font-semibold text-muted-foreground">{label}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
        <NewProjectFab onPress={handleNewProject} />
        {deleteModal}
        {newProjectModal}
      </>
    );
  }

  const pct = project.overallProgressPct;
  const status = progressLabel(pct);
  const cmp = compareBudget(project.budget, project.totalEstimate);

  const budgetPills = [
    { label: "Your Budget", value: formatBudget(project.budget), color: "#9ca3af" },
    { label: "AI Estimate", value: peso(project.totalEstimate), color: "#f59e0b" },
    ...(cmp.hasBudget
      ? [
          {
            label: cmp.difference >= 0 ? "Left Over" : "Short By",
            value: peso(Math.abs(cmp.difference)),
            color: cmp.difference >= 0 ? "#10b981" : "#ef4444",
          },
        ]
      : []),
  ];

  return (
    <>
      <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 16, paddingBottom: 96, gap: 16 }}>
      {picker}
      {/* Hero project card */}
      <View className="rounded-3xl p-5 bg-card border border-border">
        <View className="flex-row items-start justify-between mb-4">
          <View className="flex-1 pr-3">
            <View
              className="self-start px-2 py-0.5 rounded-full mb-1"
              style={{ backgroundColor: `${status.color}20` }}
            >
              <Text className="text-xs font-bold" style={{ color: status.color }}>
                {status.label}
              </Text>
            </View>
            <Text className="text-lg font-extrabold text-foreground">{project.title}</Text>
            <Text className="text-xs mt-0.5 text-muted-foreground">
              {project.location ? `${project.location} · ` : ""}Started {new Date(project.startedAt).toLocaleDateString()}
            </Text>
          </View>
          <ProgressRing pct={pct} />
        </View>

        <View className="flex-row flex-wrap gap-2 mb-4">
          {budgetPills.map(({ label, value, color }) => (
            <View key={label} className="px-3 py-2.5 rounded-2xl bg-background" style={{ flexGrow: 1, flexBasis: "28%" }}>
              <Text className="text-xs mb-0.5 text-muted-foreground">{label}</Text>
              <Text className="font-bold text-sm" style={{ color, fontFamily: "DMMono_500Medium" }}>
                {value}
              </Text>
            </View>
          ))}
        </View>

        <View>
          <View className="flex-row justify-between mb-1.5">
            <Text className="text-xs text-muted-foreground">Overall Progress</Text>
            <Text className="text-xs" style={{ color: status.color }}>
              {pct}%
            </Text>
          </View>
          <ProgressBar pct={pct} color="#f59e0b" height={10} />
        </View>
      </View>

      {/* Quick actions */}
      <View className="flex-row flex-wrap gap-2">
        {QUICK_ACTIONS.map(({ label, icon, href }) => (
          <Pressable
            key={href}
            onPress={() => router.push(href as never)}
            className="items-center gap-1.5 py-3.5 rounded-2xl bg-card border border-border"
            style={{ width: "23%" }}
          >
            <Ionicons name={icon} size={22} color="#f59e0b" />
            <Text className="text-xs font-semibold text-muted-foreground">{label}</Text>
          </Pressable>
        ))}
      </View>

      {/* Stats row */}
      <View className="flex-row gap-2">
        {[
          { label: "Active Projects", value: data!.stats.active, color: "#f59e0b" },
          { label: "Completed", value: data!.stats.completed, color: "#10b981" },
        ].map(({ label, value, color }) => (
          <View key={label} className="flex-1 p-4 rounded-2xl items-center bg-card border border-border">
            <Text className="text-2xl font-extrabold mb-0.5" style={{ color }}>
              {value}
            </Text>
            <Text className="text-xs text-muted-foreground">{label}</Text>
          </View>
        ))}
      </View>

      {/* Construction phases */}
      <View className="rounded-3xl p-4 bg-card border border-border">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="font-bold text-sm text-foreground">Construction Phases</Text>
          <Pressable onPress={() => router.push("/homeowner/progress" as never)}>
            <Text className="text-xs font-semibold text-primary">View All →</Text>
          </Pressable>
        </View>
        <View style={{ gap: 12 }}>
          {project.phases.map(({ name, progressPct }, i) => (
            <View key={`${name}-${i}`}>
              <View className="flex-row justify-between mb-1.5">
                <Text className="text-xs text-muted-foreground">{name}</Text>
                <Text
                  className="text-xs font-semibold"
                  style={{ color: progressPct === 100 ? "#10b981" : progressPct > 0 ? "#f59e0b" : "#374151" }}
                >
                  {progressPct}%
                </Text>
              </View>
              <ProgressBar
                pct={progressPct}
                height={8}
                color={progressPct === 100 ? "#10b981" : progressPct > 50 ? "#f59e0b" : progressPct > 0 ? "#3b82f6" : "#252a3a"}
              />
            </View>
          ))}
        </View>
      </View>

      {/* Project team */}
      <View className="rounded-3xl p-4 bg-card border border-border">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="font-bold text-sm text-foreground">Project Team</Text>
          <Pressable onPress={() => router.push("/homeowner/marketplace" as never)}>
            <Text className="text-xs font-semibold text-primary">Find Team →</Text>
          </Pressable>
        </View>
        {project.contractors.length === 0 && project.workers.length === 0 ? (
          <Text className="text-xs text-muted-foreground">
            No contractors or workers added yet. Search and add your team from Find Your Team.
          </Text>
        ) : (
          <View style={{ gap: 8 }}>
            {project.contractors.map((c) => (
              <View key={`contractor-${c.id}`} className="flex-row items-center gap-3 px-3 py-2.5 rounded-xl bg-muted">
                <Ionicons name="business-outline" size={16} color="#10b981" />
                <View className="flex-1">
                  <Text className="text-xs font-medium text-foreground">{c.companyName || c.name}</Text>
                  <Text className="text-xs text-muted-foreground">{c.specialization || "Contractor"}</Text>
                </View>
                <MessageButton
                  compact
                  projectId={project.id}
                  contractorId={c.id}
                  chatPath={(id) => `/homeowner/messages/${id}`}
                  label={`Message ${c.companyName || c.name}`}
                />
              </View>
            ))}
            {project.workers.map((w) => (
              <View key={`worker-${w.id}`} className="flex-row items-center gap-3 px-3 py-2.5 rounded-xl bg-muted">
                <Ionicons name="hammer-outline" size={16} color="#f59e0b" />
                <View className="flex-1">
                  <Text className="text-xs font-medium text-foreground">{w.name}</Text>
                  <Text className="text-xs text-muted-foreground">{w.trade || "Worker"}</Text>
                </View>
                <MessageButton
                  compact
                  projectId={project.id}
                  workerId={w.id}
                  chatPath={(id) => `/homeowner/messages/${id}`}
                  label={`Message ${w.name}`}
                />
              </View>
            ))}
          </View>
        )}
      </View>
      </ScrollView>
      <NewProjectFab onPress={handleNewProject} />
      {deleteModal}
      {newProjectModal}
    </>
  );
}
