import { useCallback, useRef, useState } from "react";
import { AppState, ScrollView, Text, View, Pressable, ActivityIndicator, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CountUp, ProgressRing } from "@/components/charts";
import { ProgressBar } from "@/components/ui";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { addProjectBudget, createDraftProject, deleteProject, fetchDashboard, fetchMyHomeownerProjects, setTeamWage } from "@/services/api/projects";
import type { DashboardData, ProjectStatus, ProjectSummary, Wage, WageInput } from "@/types/project";
import { peso } from "@/utils/currency";
import { compareBudget, formatBudget } from "@/utils/budget";
import { usePlan } from "@/context/PlanContext";
import { colors } from "@/theme/colors";
import Mascot from "@/components/Mascot";
import MessageButton from "@/components/MessageButton";
import ProjectCompletionCard from "@/components/ProjectCompletionCard";
import ProjectRatingPrompt from "@/components/ProjectRatingPrompt";
import ProjectCalendar from "@/screens/timeline/ProjectCalendar";
import WageSheet from "@/components/WageSheet";
import AddBudgetSheet from "@/components/AddBudgetSheet";
import { wageLine } from "@/utils/wage";

const QUICK_ACTIONS = [
  { label: "AI Plan", icon: "sparkles-outline", href: "/homeowner/project-chat" },
  { label: "Budget", icon: "wallet-outline", href: "/homeowner/budget-monitor" },
  { label: "Progress", icon: "stats-chart-outline", href: "/homeowner/progress" },
  { label: "Approvals", icon: "checkmark-circle-outline", href: "/homeowner/approvals" },
] as const;

/** The hero card's tag. "Completed" is now something the homeowner confirms, not just a progress reading. */
function projectLabel(status: ProjectStatus, pct: number): { label: string; color: string } {
  if (status === "completed") return { label: "COMPLETED", color: "#10b981" };
  if (status === "pending_confirmation") return { label: "PENDING CONFIRMATION", color: "#8b5cf6" };
  if (pct >= 100) return { label: "ALL TASKS DONE", color: "#10b981" };
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

/* NEW PROJECT CONFIRMATION — shown when the homeowner already has projects, so they don't spin up
 * another by accident. Confirming adds it to YOUR PROJECTS right away as "not started yet"; their
 * other projects and their AI chats are untouched. A first-ever project skips this. */
function NewProjectModal({
  visible,
  creating,
  projectCount,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  creating: boolean;
  projectCount: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: "rgba(0,0,0,0.65)" }}>
        <View className="w-full rounded-3xl p-6 items-center bg-card border border-border" style={{ maxWidth: 340 }}>
          <Mascot size={88} mood="happy" bob />
          <Text className="text-base font-extrabold mt-3 text-foreground">Create another project?</Text>
          <Text className="text-xs text-center mt-2 leading-5 text-muted-foreground">
            You already have {projectCount} project{projectCount === 1 ? "" : "s"}. Are you sure you want to make a
            new one? It will be added to your projects as &quot;Not started yet&quot; until you plan it with PandAi
            and approve the plan. Your other projects stay exactly as they are.
          </Text>
          <View className="flex-row gap-2 mt-5 w-full">
            <Pressable
              onPress={onCancel}
              disabled={creating}
              className="flex-1 py-2.5 rounded-xl items-center bg-muted border border-border"
            >
              <Text className="text-sm font-semibold text-muted-foreground">Cancel</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              disabled={creating}
              className="flex-1 py-2.5 rounded-xl items-center bg-primary"
              style={{ opacity: creating ? 0.6 : 1 }}
            >
              {creating ? (
                <ActivityIndicator size="small" color="#0f1117" />
              ) : (
                <Text className="text-sm font-bold text-primary-foreground">Yes, Create It</Text>
              )}
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

/* A small pill on a team row for setting or editing that person's wage. */
function WageButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={6} className="px-2.5 py-1.5 rounded-lg" style={{ backgroundColor: "#f59e0b20" }}>
      <Text className="text-xs font-semibold" style={{ color: "#f59e0b" }}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function Dashboard() {
  const { ready: planReady, selectProject: selectPlanProject, startFresh: startFreshPlan } = usePlan();
  const [data, setData] = useState<DashboardData | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectSummary | null>(null);
  const [confirmNewProject, setConfirmNewProject] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  // The team member whose wage is being set, if any.
  const [wageTarget, setWageTarget] = useState<{ role: "worker" | "contractor"; id: number; name: string; wage: Wage | null | undefined; minDailyWage?: number | null } | null>(null);
  const [addingBudget, setAddingBudget] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
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
      if (!planReady) return;
      if (!consumedDeepLink.current && deepLinkProjectId) {
        selectedProjectIdRef.current = Number(deepLinkProjectId);
        consumedDeepLink.current = true;
      }
      let cancelled = false;
      let inFlight = false;
      let firstLoad = true;
      setLoading(true);
      setError(null);
      const refresh = () => {
        if (inFlight) return;
        inFlight = true;
        const requestedId = selectedProjectIdRef.current;
        Promise.all([fetchDashboard(requestedId ?? undefined), fetchMyHomeownerProjects()])
        .then(([dashboard, list]) => {
          if (cancelled || selectedProjectIdRef.current !== requestedId) return;
          setData(dashboard);
          setError(null);
          setProjects(list);
          const id = dashboard.project?.id ?? null;
          setSelectedProjectId(id);
          selectedProjectIdRef.current = id;
          if (firstLoad || id !== requestedId) selectPlanProject(id, dashboard.project?.approvedPlan);
          firstLoad = false;
        })
        .catch((err) => {
          if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load dashboard.");
        })
        .finally(() => {
          inFlight = false;
          if (!cancelled) setLoading(false);
        });
      };
      refresh();
      const timer = setInterval(() => {
        if (AppState.currentState === "active") refresh();
      }, 15000);
      const subscription = AppState.addEventListener("change", (state) => {
        if (state === "active") refresh();
      });
      return () => {
        cancelled = true;
        clearInterval(timer);
        subscription.remove();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [planReady])
  );

  const switchProject = useCallback((projectId: number) => {
    if (projectId === selectedProjectId) return;
    setSwitching(true);
    setSelectedProjectId(projectId);
    selectedProjectIdRef.current = projectId;
    selectPlanProject(projectId);
    fetchDashboard(projectId)
      .then((dashboard) => {
        if (selectedProjectIdRef.current !== projectId) return;
        setData(dashboard);
        selectPlanProject(projectId, dashboard.project?.approvedPlan);
      })
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

  // Opens the AI planner on this project's own conversation — each project keeps its own chat, so
  // a new project's planning never mixes into another project's.
  const openPlanner = useCallback(
    (projectId: number, fresh = false) => {
      // A just-created project starts from a completely blank chat; an existing one resumes its own.
      if (fresh) startFreshPlan(projectId);
      else selectPlanProject(projectId);
      selectedProjectIdRef.current = projectId;
      router.push("/homeowner/project-chat" as never);
    },
    [selectPlanProject, startFreshPlan]
  );

  // Adds the project to YOUR PROJECTS right away as "not started yet" (see createDraftProject), then
  // opens its chat.
  const createNewProject = useCallback(() => {
    setCreatingProject(true);
    setCreateError(null);
    createDraftProject()
      .then((draft) => {
        setProjects((list) => (list.some((p) => p.id === draft.id) ? list : [draft, ...list]));
        setConfirmNewProject(false);
        openPlanner(draft.id, draft.created);
      })
      .catch((err) => {
        setConfirmNewProject(false);
        setCreateError(err instanceof Error ? err.message : "Couldn't create the project.");
      })
      .finally(() => setCreatingProject(false));
  }, [openPlanner]);

  const handleNewProject = useCallback(() => {
    // One not-started project at a time: if one is already waiting, pick it back up instead of
    // adding another blank.
    const waiting = projects.find((p) => p.status === "not_started");
    if (waiting) {
      openPlanner(waiting.id);
    } else if (projects.length > 0) {
      setConfirmNewProject(true);
    } else {
      createNewProject();
    }
  }, [projects, openPlanner, createNewProject]);

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

  // Saves the wage, then re-reads the project so every row and the team total reflect it. Rejects with
  // the backend's message so the sheet can show it.
  const saveWage = async (input: WageInput) => {
    if (!project || !wageTarget) return;
    await setTeamWage(project.id, wageTarget.role, wageTarget.id, input);
    setData(await fetchDashboard(project.id));
  };

  // Adds to the budget and swaps in the updated project. Rejects with the backend's message for the sheet.
  const addBudget = async (amount: number) => {
    if (!project) return;
    const updated = await addProjectBudget(project.id, amount);
    setData((current) => (current ? { ...current, project: updated } : current));
    selectPlanProject(updated.id, updated.approvedPlan);
  };

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
                  {p.status === "not_started"
                    ? " · Not started"
                    : p.status === "pending_confirmation"
                      ? " · To confirm"
                      : p.status === "completed"
                        ? " · Completed"
                        : ""}
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
      creating={creatingProject}
      projectCount={projects.length}
      onCancel={() => setConfirmNewProject(false)}
      onConfirm={createNewProject}
    />
  );

  const createErrorNote = createError ? <Text className="text-xs text-danger">{createError}</Text> : null;

  // Nothing to show yet for a project still waiting on its plan (no phases, budget or progress).
  if (!project || project.status === "not_started") {
    return (
      <>
        <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 16, paddingBottom: 96, gap: 16 }}>
          {picker}
          {createErrorNote}
          {project ? (
            <View className="rounded-3xl p-6 items-center bg-card border border-border">
              <View className="px-2 py-0.5 rounded-full mb-2" style={{ backgroundColor: "#9ca3af20" }}>
                <Text className="text-xs font-bold" style={{ color: "#9ca3af" }}>
                  NOT STARTED YET
                </Text>
              </View>
              <Mascot size={80} mood="thinking" bob />
              <Text className="font-bold text-base mb-1 mt-2 text-foreground">{project.title}</Text>
              <Text className="text-sm text-center mb-4 text-muted-foreground">
                This project hasn&apos;t started yet. Describe it to PandAi and approve the plan to get its budget,
                phases and schedule.
              </Text>
              <Pressable onPress={() => openPlanner(project.id)} className="px-5 py-2.5 rounded-xl bg-primary">
                <Text className="font-bold text-sm text-primary-foreground">Continue with PandAi</Text>
              </Pressable>
            </View>
          ) : (
            <View className="rounded-3xl p-6 items-center bg-card border border-border">
              <Mascot size={80} mood="happy" bob />
              <Text className="font-bold text-base mb-1 mt-2 text-foreground">No active project yet</Text>
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
          )}
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
  const status = projectLabel(project.status, pct);
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
      {createErrorNote}
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
              <CountUp text={value} className="font-bold text-sm" style={{ color, fontFamily: "DMMono_500Medium" }} />
              {/* The estimate went up because the work outgrew the plan — say by how much, so "Left Over" shrinking isn't a mystery. */}
              {label === "AI Estimate" && !!project.estimateAdjustment?.additionsTotal && (
                <CountUp text={`+${peso(project.estimateAdjustment.additionsTotal)} added`} className="text-xs mt-0.5" style={{ color: colors.danger }} />
              )}
            </View>
          ))}
        </View>
        {!!project.estimateAdjustment?.pendingMaterialsTotal && (
          <Pressable onPress={() => router.push("/homeowner/approvals" as never)} className="mb-4">
            <Text className="text-xs" style={{ color: colors.warning }}>
              {peso(project.estimateAdjustment.pendingMaterialsTotal)} more in material requests is waiting for your approval →
            </Text>
          </Pressable>
        )}
        {cmp.status === "over" && (
          <Pressable
            onPress={() => setAddingBudget(true)}
            accessibilityRole="button"
            className="flex-row items-center justify-center gap-2 py-2.5 rounded-xl mb-4"
            style={{ backgroundColor: "#ef444420" }}
          >
            <Ionicons name="add-circle-outline" size={16} color="#ef4444" />
            <Text className="text-sm font-bold" style={{ color: "#ef4444" }}>
              Over budget — Add Budget
            </Text>
          </Pressable>
        )}

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

      {/* The contractor's finished-project submission waiting for the homeowner, or how it ended */}
      <ProjectCompletionCard
        key={`project-completion-${project.id}`}
        project={project}
        onChanged={async () => setData(await fetchDashboard(project.id))}
      />

      {/* At 100%, invites the homeowner to rate the contractor and workers who built it */}
      <ProjectRatingPrompt key={`project-rating-${project.id}`} projectId={project.id} progressPct={project.status === "completed" ? 100 : pct} />

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

      {/* The AI-proposed schedule vs real progress; the phases card above already lists the phases. */}
      <ProjectCalendar key={`project-calendar-${project.id}`} projectId={project.id} showPhases={false} />

      {/* Project team */}
      <View className="rounded-3xl p-4 bg-card border border-border">
        <View className="flex-row items-center justify-between mb-3">
          <View>
            <Text className="font-bold text-sm text-foreground">Project Team</Text>
            {!!project.teamWageTotal && (
              <Text className="text-xs mt-0.5 text-muted-foreground">
                Team wages <Text className="font-semibold" style={{ color: "#f59e0b" }}>{peso(project.teamWageTotal)}</Text>
              </Text>
            )}
          </View>
          <Pressable onPress={() => router.push("/homeowner/marketplace" as never)}>
            <Text className="text-xs font-semibold text-primary">Find Team →</Text>
          </Pressable>
        </View>
        <Text className="text-xs mb-3 leading-5 text-muted-foreground">Wages are filled in automatically when your team joins. Automatic amounts are estimates; custom amounts are optional.</Text>
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
                  <Text className="text-xs mt-0.5" style={{ color: c.wage ? "#10b981" : "#6b7280" }}>{wageLine(c.wage)}</Text>
                </View>
                <WageButton
                  label={c.wage ? "Wage options" : "Auto wage"}
                  onPress={() => setWageTarget({ role: "contractor", id: c.id, name: c.companyName || c.name, wage: c.wage })}
                />
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
                  <Text className="text-xs mt-0.5" style={{ color: w.wage ? "#10b981" : "#6b7280" }}>{wageLine(w.wage)}</Text>
                  {w.minDailyWage != null && <Text className="text-xs text-muted-foreground">Asks from {peso(w.minDailyWage)}/day</Text>}
                </View>
                <WageButton
                  label={w.wage ? "Wage options" : "Auto wage"}
                  onPress={() => setWageTarget({ role: "worker", id: w.id, name: w.name, wage: w.wage, minDailyWage: w.minDailyWage })}
                />
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
      {wageTarget && (
        <WageSheet
          name={wageTarget.name}
          current={wageTarget.wage}
          defaultUnit={wageTarget.role === "contractor" ? "fixed" : "per_day"}
          minDailyWage={wageTarget.minDailyWage}
          onClose={() => setWageTarget(null)}
          onSave={saveWage}
        />
      )}
      {addingBudget && (
        <AddBudgetSheet budget={project.budget} estimate={project.totalEstimate} onClose={() => setAddingBudget(false)} onSave={addBudget} />
      )}
      {deleteModal}
      {newProjectModal}
    </>
  );
}
