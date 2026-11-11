import { useCallback, useRef, useState } from "react";
import { AppState, ScrollView, Text, View, Pressable, ActivityIndicator, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CountUp, ProgressRing } from "@/components/charts";
import { ProgressBar } from "@/components/ui";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { addProjectBudget, setTeamWage } from "@/services/api/projects";
import { fetchProjectOverview, fetchDashboardProjects, removeProjectFromDashboard } from "@/services/api/dashboard";
import type { DashboardData, ProjectStatus, ProjectSummary, Wage, WageInput } from "@/types/project";
import { peso } from "@/utils/currency";
import { compareBudget, formatBudget } from "@/utils/budget";
import { usePlan } from "@/context/PlanContext";
import { useTheme } from "@/context/ThemeContext";
import { colors } from "@/theme/colors";
import Mascot from "@/components/Mascot";
import MessageButton from "@/components/MessageButton";
import ProjectChecklistCard from "@/components/ProjectChecklistCard";
import ProjectCompletionCard from "@/components/ProjectCompletionCard";
import ProjectRatingPrompt from "@/components/ProjectRatingPrompt";
import ProjectCalendar from "@/screens/timeline/ProjectCalendar";
import WageSheet from "@/components/WageSheet";
import AddBudgetSheet from "@/components/AddBudgetSheet";
import { wageLine } from "@/utils/wage";

/** The hero card's tag. "Completed" is now something the homeowner confirms, not just a progress reading. */
function projectLabel(status: ProjectStatus, pct: number): { label: string; color: string } {
  if (status === "completed") return { label: "COMPLETED", color: "#10b981" };
  if (status === "pending_confirmation") return { label: "PENDING CONFIRMATION", color: "#8b5cf6" };
  if (pct >= 100) return { label: "ALL TASKS DONE", color: "#10b981" };
  if (pct > 0) return { label: "IN PROGRESS", color: "#f59e0b" };
  return { label: "JUST STARTED", color: "#9ca3af" };
}

/* DASHBOARD REMOVAL — reuse the existing confirmation layout while retaining the project in History. */
function RemoveFromDashboardModal({
  project,
  removing,
  error,
  onCancel,
  onConfirm,
}: {
  project: ProjectSummary | null;
  removing: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal visible={!!project} transparent animationType="fade" onRequestClose={removing ? () => {} : onCancel}>
      <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: "rgba(0,0,0,0.65)" }}>
        <View className="w-full rounded-3xl p-6 items-center bg-card border border-border" style={{ maxWidth: 340 }}>
          <Mascot size={88} mood="thinking" bob />
          <Text className="text-base font-extrabold mt-3 text-foreground">Remove from Dashboard?</Text>
          <Text className="text-xs text-center mt-2 leading-5 text-muted-foreground">
            Remove <Text className="font-semibold text-foreground">{project?.title}</Text> from your dashboard?
            This project will only be hidden from the Home Dashboard. It will remain saved in your History,
            including its progress, budget, workers, and project details.
          </Text>
          {error && <Text className="text-xs text-center mt-3 text-danger" accessibilityLiveRegion="polite">{error}</Text>}
          <View className="flex-row gap-2 mt-5 w-full">
            <Pressable
              onPress={onCancel}
              disabled={removing}
              className="flex-1 py-2.5 rounded-xl items-center bg-muted border border-border"
            >
              <Text className="text-sm font-semibold text-muted-foreground">Cancel</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              disabled={removing}
              className="flex-1 py-2.5 rounded-xl items-center flex-row justify-center gap-1.5 bg-danger"
              style={{ opacity: removing ? 0.6 : 1 }}
            >
              {removing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="close-circle-outline" size={14} color="#fff" />
                  <Text className="text-sm font-bold text-white">Remove</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
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

export default function ProjectOverview() {
  const insets = useSafeAreaInsets();
  const { chrome } = useTheme();
  const { ready: planReady, selectProject: selectPlanProject } = usePlan();
  const [data, setData] = useState<DashboardData | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [removeTarget, setRemoveTarget] = useState<ProjectSummary | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const removalInFlight = useRef(false);
  const dashboardRevision = useRef(0);
  // The team member whose wage is being set, if any.
  const [wageTarget, setWageTarget] = useState<{ role: "worker" | "contractor"; id: number; name: string; wage: Wage | null | undefined; minDailyWage?: number | null } | null>(null);
  const [addingBudget, setAddingBudget] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Mirrors selectedProjectId but readable from inside the focus effect below without making it
  // re-run on every selection change — this lets returning to Project Overview re-fetch whichever
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
        const revision = dashboardRevision.current;
        Promise.all([fetchProjectOverview(requestedId ?? undefined), fetchDashboardProjects()])
        .then(([dashboard, list]) => {
          if (cancelled || dashboardRevision.current !== revision || selectedProjectIdRef.current !== requestedId) return;
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
          if (!cancelled && dashboardRevision.current === revision) setError(err instanceof Error ? err.message : "Failed to load dashboard.");
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
    fetchProjectOverview(projectId)
      .then((dashboard) => {
        if (selectedProjectIdRef.current !== projectId) return;
        setData(dashboard);
        const actualId = dashboard.project?.id ?? null;
        setSelectedProjectId(actualId);
        selectedProjectIdRef.current = actualId;
        selectPlanProject(actualId, dashboard.project?.approvedPlan);
        if (actualId !== projectId) setProjects((list) => list.filter((item) => item.id !== projectId));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load project."))
      .finally(() => setSwitching(false));
  }, [selectedProjectId, selectPlanProject]);

  const handleRemove = useCallback(async (projectId: number) => {
    if (removalInFlight.current) return;
    removalInFlight.current = true;
    dashboardRevision.current += 1;
    setRemovingId(projectId);
    setRemoveError(null);
    try {
      await removeProjectFromDashboard(projectId);
      // Invalidate polls that began before the save, so an old response cannot restore the chip.
      dashboardRevision.current += 1;
      const remaining = projects.filter((item) => item.id !== projectId);
      setProjects((list) => list.filter((item) => item.id !== projectId));
      setRemoveTarget(null);
      if (selectedProjectIdRef.current !== projectId) return;
      const next = remaining[0]?.id ?? null;
      setSelectedProjectId(next);
      selectedProjectIdRef.current = next;
      selectPlanProject(next);
      setData((current) => current ? { ...current, project: null } : current);
      try {
        const dashboard = await fetchProjectOverview(next ?? undefined);
        if (selectedProjectIdRef.current !== next) return;
        setData(dashboard);
        const actualId = dashboard.project?.id ?? null;
        setSelectedProjectId(actualId);
        selectedProjectIdRef.current = actualId;
        selectPlanProject(actualId, dashboard.project?.approvedPlan);
      } catch {
        setError("The project was removed from Home, but the dashboard couldn't refresh. Reopen Home to try again.");
      }
    } catch (failure) {
      setRemoveError(failure instanceof Error ? failure.message : "Couldn't remove the project. Please try again.");
    } finally {
      removalInFlight.current = false;
      setRemovingId(null);
    }
  }, [projects, selectPlanProject]);

  const openPlanner = (projectId: number) => {
    selectedProjectIdRef.current = projectId;
    selectPlanProject(projectId);
    router.push("/homeowner/project-chat" as never);
  };

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
    setData(await fetchProjectOverview(project.id));
  };

  // Adds to the budget and swaps in the updated project. Rejects with the backend's message for the sheet.
  const addBudget = async (amount: number) => {
    if (!project) return;
    const updated = await addProjectBudget(project.id, amount);
    setData((current) => (current ? { ...current, project: updated } : current));
    selectPlanProject(updated.id, updated.approvedPlan);
  };

  // Always shown (even with just one project), styled like browser tabs — compact, with
  // a close "x" on completed projects for a Home-only visibility preference.
  const picker = projects.length > 0 && (
    <View>
      <Text className="text-xs font-semibold mb-2 text-muted-foreground">YOUR PROJECTS</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {projects.map((p) => {
          const active = p.id === selectedProjectId;
          const isRemoving = removingId === p.id;
          return (
            <View
              key={p.id}
              className="flex-row items-center rounded-lg border"
              style={{
                backgroundColor: active ? "#f59e0b20" : "#1a1d27",
                borderColor: active ? "#f59e0b50" : "#2a2f42",
                opacity: isRemoving ? 0.5 : 1,
              }}
            >
              <Pressable
                onPress={() => switchProject(p.id)}
                disabled={switching || isRemoving}
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
              {p.status === "completed" && <Pressable
                onPress={() => { setRemoveError(null); setRemoveTarget(p); }}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${p.title} from dashboard`}
                disabled={isRemoving}
                hitSlop={8}
                className="py-2 pl-1 pr-2.5"
              >
                {isRemoving ? (
                  <ActivityIndicator size="small" color="#6b7280" />
                ) : (
                  <Ionicons name="close" size={14} color="#6b7280" />
                )}
              </Pressable>}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );

  const removeModal = (
    <RemoveFromDashboardModal
      project={removeTarget}
      removing={removingId === removeTarget?.id}
      error={removeError}
      onCancel={() => { if (!removalInFlight.current) { setRemoveTarget(null); setRemoveError(null); } }}
      onConfirm={() => removeTarget && void handleRemove(removeTarget.id)}
    />
  );

  // Nothing to show yet for a project still waiting on its plan (no phases, budget or progress).
  if (!project || project.status === "not_started") {
    return (
      <>
        <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 16, gap: 16 }}>
          {picker}
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
        </ScrollView>
        {removeModal}
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
      <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 16, gap: 16 }}>
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
            <Text className="text-xs" style={{ color: chrome.foreground }}>
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
        onChanged={async () => setData(await fetchProjectOverview(project.id))}
      />

      {/* Small projects with no contractor: the homeowner manages the checklist themselves. */}
      {project.canManageChecklist && (
        <View className="rounded-3xl p-4 bg-card border border-border">
          <Text className="font-bold text-sm text-foreground mb-3">Project Checklist</Text>
          <ProjectChecklistCard
            key={`project-checklist-${project.id}`}
            project={project}
            onChanged={async () => setData(await fetchProjectOverview(project.id))}
          />
        </View>
      )}

      {/* At 100%, invites the homeowner to rate the contractor and workers who built it */}
      <ProjectRatingPrompt key={`project-rating-${project.id}`} projectId={project.id} progressPct={project.status === "completed" ? 100 : pct} />

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
                <Text className="text-xs" style={{ color: chrome.foreground, flex: 1 }}>{name}</Text>
                <Text
                  className="text-xs font-semibold"
                  style={{ color: chrome.foreground }}
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
      {removeModal}
    </>
  );
}
