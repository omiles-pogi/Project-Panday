import { useState } from "react";
import { Text, View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button, Field, ProgressBar } from "@/components/ui";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import {
  addPhaseTask,
  checkAllTasks,
  deletePhaseTask,
  submitProjectCompletion,
  togglePhaseTask,
  uncheckAllTasks,
} from "@/services/api/projects";
import type { DashboardPhase, DashboardProject } from "@/types/project";

function PhaseChecklist({
  projectId,
  editable,
  phase,
  onChanged,
}: {
  projectId: number;
  editable: boolean;
  phase: DashboardPhase;
  onChanged: () => Promise<void>;
}) {
  const [newTask, setNewTask] = useState("");
  const [adding, setAdding] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState<number | null>(null);
  const [bulk, setBulk] = useState<"check" | "uncheck" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const doneCount = phase.tasks.filter((task) => task.isDone).length;
  const busy = busyTaskId !== null || adding || bulk !== null;

  // Check All / Uncheck All for this phase only, each behind a confirmation. Saved to the server, so it
  // stays after a refresh.
  const runBulk = async (kind: "check" | "uncheck") => {
    if (busy) return;
    setBulk(kind);
    setError(null);
    try {
      await (kind === "check" ? checkAllTasks(projectId, phase.id) : uncheckAllTasks(projectId, phase.id));
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
      await addPhaseTask(projectId, phase.id, description);
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
      await togglePhaseTask(projectId, phase.id, taskId, isDone);
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
      await deletePhaseTask(projectId, phase.id, taskId);
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

/**
 * Lets whoever manages this project's checklist — an assigned contractor, or the homeowner
 * themselves on a small project with no contractor assigned — check off tasks per phase and submit
 * the project as finished. Renders nothing for anyone else; the server enforces this too.
 */
export default function ProjectChecklistCard({
  project,
  onChanged,
}: {
  project: DashboardProject;
  onChanged: () => Promise<void>;
}) {
  const [busyAction, setBusyAction] = useState<"finish" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const { ask, dialog } = useConfirmDialog();

  if (!project.canManageChecklist) return null;

  const checklist = project.checklist ?? { totalTasks: 0, doneTasks: 0, pct: 0 };
  const editable = !project.checklistLocked;

  const runFinish = async () => {
    if (busyAction) return;
    setBusyAction("finish");
    setActionError(null);
    try {
      await submitProjectCompletion(project.id);
      await onChanged();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "That didn't go through. Please try again.");
    } finally {
      setBusyAction(null);
    }
  };

  const confirmFinish = () =>
    ask({
      title: "Mark Project as Finished",
      detail: project.title,
      message: "Are you sure you want to mark this project as finished? Please confirm that all construction tasks have been completed.",
      confirmLabel: "Yes, mark as finished",
      icon: "flag-outline",
      mood: "happy",
      onConfirm: () => void runFinish(),
    });

  return (
    <View style={{ gap: 10 }}>
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
        <PhaseChecklist key={phase.id} projectId={project.id} editable={editable} phase={phase} onChanged={onChanged} />
      ))}

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
      {dialog}
    </View>
  );
}
