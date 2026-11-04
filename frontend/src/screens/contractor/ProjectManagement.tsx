import { useState } from "react";
import { Text, View, Pressable, ActivityIndicator } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { CountUp } from "@/components/charts";
import { Badge, Button, Card, Field, PageHeader, ProgressBar, Screen } from "@/components/ui";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import MessageButton from "@/components/MessageButton";
import ProjectStatusBanner from "@/components/ProjectStatusBanner";
import TeamActivity from "@/components/TeamActivity";
import {
  addPhaseTask,
  checkAllTasks,
  deletePhaseTask,
  fetchMyProjects,
  setTeamWage,
  submitProjectCompletion,
  togglePhaseTask,
  uncheckAllTasks,
} from "@/services/api/projects";
import { projectStatusMeta } from "@/utils/projectStatus";
import { createMaterialRequest } from "@/services/api/materialRequests";
import WageSheet from "@/components/WageSheet";
import type { MyProject, Wage, WageInput } from "@/types/project";
import { peso } from "@/utils/currency";
import { wageLine } from "@/utils/wage";
import { useFocusedResource } from "@/hooks/useFocusedResource";

function PhaseChecklist({
  project,
  phase,
  onChanged,
}: {
  project: MyProject;
  phase: MyProject["phases"][number];
  onChanged: () => Promise<void>;
}) {
  const [newTask, setNewTask] = useState("");
  const [adding, setAdding] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState<number | null>(null);
  const [bulk, setBulk] = useState<"check" | "uncheck" | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Only the project's contractor can edit, and only while it's ongoing — once submitted as finished,
  // or completed, the checklist is read-only (the server enforces this too).
  const editable = project.canManageChecklist && !project.checklistLocked;
  const doneCount = phase.tasks.filter((task) => task.isDone).length;
  const busy = busyTaskId !== null || adding || bulk !== null;

  // Check All / Uncheck All for this phase only, each behind a confirmation. Saved to the server, so it
  // stays after a refresh.
  const runBulk = async (kind: "check" | "uncheck") => {
    if (busy) return;
    setBulk(kind);
    setError(null);
    try {
      await (kind === "check" ? checkAllTasks(project.id, phase.id) : uncheckAllTasks(project.id, phase.id));
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update this phase. Please try again.");
    } finally {
      setBulk(null);
    }
  };

  const { ask, dialog } = useConfirmDialog();
  const taskCount = `${phase.tasks.length} ${phase.tasks.length === 1 ? "task" : "tasks"}`;

  const confirmCheckAll = () =>
    ask({
      title: "Check all tasks?",
      detail: `${phase.name} · ${taskCount}`,
      message: "This marks every task in this phase as completed. While the project is ongoing you can uncheck them again.",
      confirmLabel: "Check All",
      icon: "checkmark-done-outline",
      mood: "happy",
      onConfirm: () => void runBulk("check"),
    });

  const confirmUncheckAll = () =>
    ask({
      title: "Uncheck all tasks?",
      detail: `${phase.name} · ${doneCount} done`,
      message: "This marks every task in this phase as not completed, and the phase's progress goes back to 0%.",
      confirmLabel: "Uncheck All",
      icon: "refresh-outline",
      mood: "thinking",
      tone: "danger",
      onConfirm: () => void runBulk("uncheck"),
    });

  const addTask = async () => {
    const description = newTask.trim();
    if (!description || adding || busyTaskId !== null) return;
    setAdding(true);
    setError(null);
    try {
      await addPhaseTask(project.id, phase.id, description);
      setNewTask("");
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the checklist item.");
    } finally {
      setAdding(false);
    }
  };

  const toggleTask = async (taskId: number, isDone: boolean) => {
    if (busy) return;
    setBusyTaskId(taskId);
    setError(null);
    try {
      await togglePhaseTask(project.id, phase.id, taskId, isDone);
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update progress. Please try again.");
    } finally {
      setBusyTaskId(null);
    }
  };

  const removeTask = async (taskId: number) => {
    if (busyTaskId !== null || adding) return;
    setBusyTaskId(taskId);
    setError(null);
    try {
      await deletePhaseTask(project.id, phase.id, taskId);
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the checklist item.");
    } finally {
      setBusyTaskId(null);
    }
  };

  return (
    <View className="px-3 py-3 rounded-xl bg-muted" style={{ gap: 8 }}>
      <View className="flex-row justify-between items-center">
        <Text className="text-xs font-semibold text-foreground">{phase.name}</Text>
        <Text className="text-xs" style={{ color: phase.progressPct === 100 ? "#10b981" : "#f59e0b" }}>
          {phase.progressPct}%
        </Text>
      </View>

      {editable && phase.tasks.length > 0 && (
        <View className="flex-row flex-wrap gap-2">
          <View style={{ flexGrow: 1, flexBasis: "40%" }}>
            <Button
              label={bulk === "check" ? "Checking…" : "Check All"}
              disabled={doneCount === phase.tasks.length || busy}
              onPress={confirmCheckAll}
            />
          </View>
          <View style={{ flexGrow: 1, flexBasis: "40%" }}>
            <Button label={bulk === "uncheck" ? "Unchecking…" : "Uncheck All"} variant="muted" disabled={doneCount === 0 || busy} onPress={confirmUncheckAll} />
          </View>
        </View>
      )}

      {error && <Text className="text-xs text-danger">{error}</Text>}
      {phase.tasks.map((task) => (
        <Pressable
          key={task.id}
          onPress={() => (editable ? toggleTask(task.id, !task.isDone) : undefined)}
          className="flex-row items-center gap-2"
          accessibilityRole="checkbox"
          accessibilityState={{ checked: task.isDone, disabled: !editable || busy }}
          disabled={!editable || busy}
        >
          <Ionicons
            name={task.isDone ? "checkbox" : "square-outline"}
            size={18}
            color={task.isDone ? "#10b981" : "#9ca3af"}
          />
          <Text
            className="flex-1 text-xs"
            style={{ color: task.isDone ? "#10b981" : "#e8eaed", textDecorationLine: task.isDone ? "line-through" : "none" }}
          >
            {task.description}
          </Text>
          {editable && (
            <Pressable onPress={(event) => { event.stopPropagation(); void removeTask(task.id); }} disabled={busy} accessibilityLabel={`Delete ${task.description}`} hitSlop={8}>
              <Ionicons name="close" size={14} color="#6b7280" />
            </Pressable>
          )}
        </Pressable>
      ))}

      {phase.tasks.length === 0 && <Text className="text-xs text-muted-foreground">No checklist items yet.</Text>}

      {editable && (
        <View className="flex-row gap-2 mt-1">
          <View className="flex-1">
            <Field
              label=""
              value={newTask}
              onChangeText={setNewTask}
              placeholder="e.g. Land filling"
              onSubmitEditing={addTask}
              returnKeyType="done"
            />
          </View>
          <Pressable
            onPress={addTask}
            disabled={adding}
            className="px-3 items-center justify-center rounded-xl bg-primary"
            style={{ opacity: adding ? 0.6 : 1 }}
          >
            <Ionicons name="add" size={16} color="#0f1117" />
          </Pressable>
        </View>
      )}

      {dialog}
    </View>
  );
}

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

  // Marking the whole project as finished, behind a confirmation.
  const [busyAction, setBusyAction] = useState<"finish" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const checklist = project.checklist ?? { totalTasks: 0, doneTasks: 0, pct: 0 };
  const editable = project.canManageChecklist && !project.checklistLocked;

  const runAction = async (kind: "finish", action: () => Promise<unknown>) => {
    if (busyAction) return;
    setBusyAction(kind);
    setActionError(null);
    try {
      await action();
      await onChanged();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "That didn't go through. Please try again.");
    } finally {
      setBusyAction(null);
    }
  };

  const { ask, dialog } = useConfirmDialog();

  const confirmFinish = () =>
    ask({
      title: "Mark Project as Finished",
      detail: project.title,
      message: "Are you sure you want to mark this project as finished? Please confirm that all construction tasks have been completed.",
      confirmLabel: "Yes, mark as finished",
      icon: "flag-outline",
      mood: "happy",
      onConfirm: () => void runAction("finish", () => submitProjectCompletion(project.id)),
    });

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

          {/* Checklist progress across every phase. Check All / Uncheck All live on each phase below. */}
          <View className="px-3 py-3 rounded-xl bg-muted" style={{ gap: 8 }}>
            <View className="flex-row items-center justify-between">
              <Text className="text-xs font-bold text-foreground">Project progress</Text>
              <Text className="text-xs font-bold" style={{ color: checklist.pct === 100 ? "#10b981" : "#f59e0b" }}>
                {checklist.pct}%
              </Text>
            </View>
            <ProgressBar pct={checklist.pct} color={checklist.pct === 100 ? "#10b981" : "#f59e0b"} height={10} />
            <Text className="text-xs text-muted-foreground">
              {checklist.doneTasks} of {checklist.totalTasks} {checklist.totalTasks === 1 ? "task" : "tasks"} completed
            </Text>
          </View>

          {actionError ? <Text className="text-xs text-danger">{actionError}</Text> : null}

          {project.phases.map((phase) => (
            <PhaseChecklist key={phase.id} project={project} phase={phase} onChanged={onChanged} />
          ))}

          {/* Only possible once everything is checked — and never automatic: the contractor decides. */}
          {editable && (
            <View style={{ gap: 6 }}>
              <Button
                label={busyAction === "finish" ? "Submitting…" : "Mark Project as Finished"}
                disabled={!project.canSubmitCompletion || busyAction !== null}
                onPress={confirmFinish}
              />
              {!project.canSubmitCompletion && (
                <Text className="text-xs text-muted-foreground">
                  {checklist.totalTasks === 0
                    ? "Add checklist tasks to be able to finish this project."
                    : "Complete every checklist task to enable this button."}
                </Text>
              )}
            </View>
          )}
        </View>
      )}

      {dialog}
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
    <Screen>
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
