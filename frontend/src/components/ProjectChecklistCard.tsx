import { useRef, useState } from "react";
import { Text, View, Pressable, ScrollView, LayoutAnimation } from "react-native";
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
import { useTheme } from "@/context/ThemeContext";
import type { ProjectTimeline } from "@/types/timeline";
import { CHECKLIST_FILTERS, checklistStates, matchesChecklistFilter, type ChecklistFilter, type ChecklistTaskState } from "@/utils/checklist";
import { formatRange } from "@/utils/timeline";

function animateAccordion() {
  LayoutAnimation?.configureNext?.(LayoutAnimation.Presets.easeInEaseOut);
}

function PhaseChecklist({
  projectId,
  editable,
  phase,
  onChanged,
  collapsible = false,
  initiallyExpanded = true,
  filter = "All",
  states,
  modern = false,
}: {
  projectId: number;
  editable: boolean;
  phase: DashboardPhase;
  onChanged: () => Promise<void>;
  collapsible?: boolean;
  initiallyExpanded?: boolean;
  filter?: ChecklistFilter;
  states?: Map<number, ChecklistTaskState>;
  modern?: boolean;
}) {
  const { chrome, mode } = useTheme();
  const secondaryText = mode === "light" ? chrome.mutedForeground : chrome.secondaryForeground;
  const completedColor = mode === "light" ? "#047857" : "#34d399";
  const [newTask, setNewTask] = useState("");
  const [adding, setAdding] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState<number | null>(null);
  const [bulk, setBulk] = useState<"check" | "uncheck" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const [showAddForm, setShowAddForm] = useState(false);
  const [phaseMenu, setPhaseMenu] = useState(false);
  const [taskMenu, setTaskMenu] = useState<number | null>(null);
  const mutation = useRef(false);
  const doneCount = phase.tasks.filter((task) => task.isDone).length;
  const busy = busyTaskId !== null || adding || bulk !== null;
  const visibleTasks = phase.tasks.filter(task => matchesChecklistFilter(task, filter, states?.get(task.id)));

  // Check All / Uncheck All for this phase only, each behind a confirmation. Saved to the server, so it
  // stays after a refresh.
  const runBulk = async (kind: "check" | "uncheck") => {
    if (!editable || busy || mutation.current) return;
    mutation.current = true;
    setBulk(kind);
    setError(null);
    try {
      await (kind === "check" ? checkAllTasks(projectId, phase.id) : uncheckAllTasks(projectId, phase.id));
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update this phase. Please try again.");
    } finally {
      mutation.current = false;
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
    if (!editable || !description || busy || mutation.current) return;
    mutation.current = true;
    setAdding(true);
    setError(null);
    try {
      await addPhaseTask(projectId, phase.id, description);
      setNewTask("");
      if (modern) setShowAddForm(false);
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the checklist item.");
    } finally {
      mutation.current = false;
      setAdding(false);
    }
  };

  const toggleTask = async (taskId: number, isDone: boolean) => {
    if (!editable || busy || mutation.current) return;
    mutation.current = true;
    setBusyTaskId(taskId);
    setError(null);
    try {
      await togglePhaseTask(projectId, phase.id, taskId, isDone);
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update progress. Please try again.");
    } finally {
      mutation.current = false;
      setBusyTaskId(null);
    }
  };

  const removeTask = async (taskId: number) => {
    if (!editable || busy || mutation.current) return;
    mutation.current = true;
    setBusyTaskId(taskId);
    setError(null);
    try {
      await deletePhaseTask(projectId, phase.id, taskId);
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the checklist item.");
    } finally {
      mutation.current = false;
      setBusyTaskId(null);
    }
  };

  const confirmRemoveTask = (taskId: number, description: string) => {
    if (!editable || busy || mutation.current) return;
    setTaskMenu(null);
    ask({ title: "Delete task?", detail: description,
      message: `Remove this task from ${phase.name}? This cannot be undone.`,
      confirmLabel: "Delete Task", icon: "trash-outline", mood: "thinking", tone: "danger",
      onConfirm: () => void removeTask(taskId) });
  };

  // The Progress drawer gets the new presentation. Existing contractor/history
  // callers continue using the legacy presentation and the very same handlers.
  if (modern) return <View style={{ backgroundColor: chrome.card, borderColor: chrome.border, borderWidth: 1, borderRadius: 18,
    padding: 14, gap: 12, shadowColor: "#000", shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 5, elevation: 1 }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${phase.name} checklist`} accessibilityHint={`${doneCount} of ${phase.tasks.length} completed; ${phase.progressPct}% phase progress`}
        accessibilityState={{ expanded }} onPress={() => { animateAccordion(); setExpanded(value => !value); }} style={{ flex: 1, minWidth: 0, minHeight: 44, flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}><Text style={{ color: chrome.foreground, fontSize: 14, fontWeight: "700", lineHeight: 20 }}>{phase.name} ({doneCount}/{phase.tasks.length})</Text>
          {expanded && <Text style={{ color: secondaryText, fontSize: 11 }}>{phase.progressPct}% phase completion</Text>}</View>
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={18} color={secondaryText} />
      </Pressable>
      {expanded && editable && phase.tasks.length > 0 && <Pressable accessibilityRole="button" accessibilityLabel={`Actions for phase ${phase.name}`} accessibilityState={{ expanded: phaseMenu, disabled: busy }} disabled={busy}
        onPress={() => { animateAccordion(); setTaskMenu(null); setPhaseMenu(value => !value); }} style={{ width: 40, height: 44, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="ellipsis-horizontal" size={20} color={secondaryText} />
      </Pressable>}
    </View>
    {expanded && <>
      {phaseMenu && editable && <View style={{ backgroundColor: chrome.muted, borderRadius: 12, padding: 6, gap: 2 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Check all tasks in ${phase.name}`} disabled={busy || doneCount === phase.tasks.length}
          onPress={() => { setPhaseMenu(false); confirmCheckAll(); }} style={{ padding: 10, opacity: busy || doneCount === phase.tasks.length ? 0.45 : 1 }}><Text style={{ color: chrome.foreground, fontSize: 12 }}>Check All</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Uncheck all tasks in ${phase.name}`} disabled={busy || doneCount === 0}
          onPress={() => { setPhaseMenu(false); confirmUncheckAll(); }} style={{ padding: 10, opacity: busy || doneCount === 0 ? 0.45 : 1 }}><Text style={{ color: chrome.foreground, fontSize: 12 }}>Uncheck All</Text></Pressable>
      </View>}
      {error && <Text accessibilityRole="alert" style={{ color: "#ef4444", fontSize: 12 }}>{error}</Text>}
      {visibleTasks.map((task, index) => {
        const state = states?.get(task.id);
        const lightColors: Record<string, string> = { "#10b981": "#047857", "#3b82f6": "#1d4ed8", "#f59e0b": "#b45309", "#ef4444": "#b91c1c", "#6b7280": "#4b5563" };
        const color = state ? mode === "light" ? lightColors[state.color] ?? state.color : state.color : secondaryText;
        return <View key={task.id} style={{ paddingVertical: 10, borderBottomWidth: index < visibleTasks.length - 1 ? 1 : 0, borderBottomColor: chrome.border, gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 6 }}>
            <Pressable accessibilityRole="checkbox" accessibilityLabel={task.description} accessibilityState={{ checked: task.isDone, disabled: !editable || busy }} disabled={!editable || busy}
              onPress={() => { if (editable) void toggleTask(task.id, !task.isDone); }} style={{ flex: 1, minWidth: 0, minHeight: 44, flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
              <View style={{ paddingTop: 2 }}><Ionicons name={task.isDone ? "checkbox" : "square-outline"} size={23} color={task.isDone ? completedColor : color} /></View>
              <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
                <Text style={{ color: chrome.foreground, fontSize: 14, lineHeight: 21, fontWeight: "600", textDecorationLine: task.isDone ? "line-through" : "none" }}>{task.description}</Text>
                {state && <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 7 }}>
                  <Text style={{ color, backgroundColor: `${state.color}18`, fontSize: 11, fontWeight: "600", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 }}>{state.label}</Text>
                  {state.scheduled && <Text style={{ color: secondaryText, fontSize: 11, lineHeight: 16, flexShrink: 1 }}>Planned: {formatRange(state.scheduled.plannedStart, state.scheduled.plannedEnd)}</Text>}
                </View>}
                {task.isDone && state?.scheduled?.completedAt && <Text style={{ color: secondaryText, fontSize: 11 }}>Completed: {state.scheduled.completedAt}</Text>}
              </View>
            </Pressable>
            {editable && <Pressable accessibilityRole="button" accessibilityLabel={`Actions for task ${task.description}`} accessibilityState={{ expanded: taskMenu === task.id, disabled: busy }} disabled={busy}
              onPress={() => { animateAccordion(); setPhaseMenu(false); setTaskMenu(value => value === task.id ? null : task.id); }} style={{ width: 36, height: 44, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="ellipsis-horizontal" size={19} color={secondaryText} />
            </Pressable>}
          </View>
          {taskMenu === task.id && editable && <View style={{ alignItems: "flex-end" }}><Pressable accessibilityRole="button" accessibilityLabel={`Delete ${task.description}`} disabled={busy}
            onPress={() => confirmRemoveTask(task.id, task.description)} style={{ paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "#ef444414", borderRadius: 12 }}>
            <Text style={{ color: mode === "light" ? "#b91c1c" : "#f87171", fontSize: 12, fontWeight: "600" }}>Delete task</Text>
          </Pressable></View>}
        </View>;
      })}
      {!phase.tasks.length && <Text style={{ color: secondaryText, fontSize: 12 }}>No checklist items yet.</Text>}
      {phase.tasks.length > 0 && !visibleTasks.length && <Text style={{ color: secondaryText, fontSize: 12 }}>No tasks in this filter for this phase.</Text>}
      {editable && (showAddForm ? <View style={{ padding: 12, borderRadius: 14, backgroundColor: chrome.muted, gap: 10 }}>
        <Field label="Task name" value={newTask} onChangeText={setNewTask} editable={!busy} placeholder="Enter task name" maxLength={255} onSubmitEditing={() => void addTask()} returnKeyType="done" />
        <View style={{ flexDirection: "row", gap: 8 }}><View style={{ flex: 1 }}><Button label={adding ? "Saving…" : "Save Task"} onPress={() => void addTask()} disabled={busy || !newTask.trim()} /></View>
          <View style={{ flex: 1 }}><Button label="Cancel" variant="muted" disabled={busy} onPress={() => { setNewTask(""); setShowAddForm(false); }} /></View></View>
      </View> : <Pressable accessibilityRole="button" accessibilityLabel={`Add task to ${phase.name}`} disabled={busy}
        onPress={() => { animateAccordion(); setError(null); setTaskMenu(null); setPhaseMenu(false); setShowAddForm(true); }} style={{ minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderWidth: 1, borderColor: "#f59e0b", borderRadius: 13 }}>
        <Ionicons name="add" size={18} color="#d97706" /><Text style={{ color: mode === "light" ? "#b45309" : "#fbbf24", fontSize: 13, fontWeight: "700" }}>Add Task</Text>
      </Pressable>)}
    </>}
    {dialog}
  </View>;

  return (
    <View className="px-3 py-3 rounded-xl bg-muted" style={{ gap: 8 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${phase.name} checklist`} accessibilityHint={`${doneCount} of ${phase.tasks.length} completed; ${phase.progressPct}% phase progress`} accessibilityState={{ expanded }} disabled={!collapsible}
        onPress={() => { if (collapsible) { animateAccordion(); setExpanded(value => !value); } }} className="flex-row justify-between items-center" style={{ gap: 8, minHeight: 42 }}>
        <Text className="text-xs font-semibold" style={{ color: chrome.foreground, flex: 1 }}>{phase.name} ({doneCount}/{phase.tasks.length})</Text>
        <Text className="text-xs" style={{ color: chrome.foreground }}>
          {phase.progressPct}%
        </Text>
        {collapsible && <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={16} color={chrome.foreground} />}
      </Pressable>
      {expanded && <>

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
      {visibleTasks.map((task) => {
        const state = states?.get(task.id);
        const lightColors: Record<string, string> = { "#10b981": "#047857", "#3b82f6": "#1d4ed8", "#f59e0b": "#b45309", "#ef4444": "#b91c1c", "#6b7280": "#4b5563" };
        const statusColor = state ? mode === "light" ? lightColors[state.color] ?? state.color : state.color : secondaryText;
        return (
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
            color={task.isDone ? completedColor : statusColor}
          />
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}><Text
            className="text-xs"
            // Keep text readable on both surfaces; the green checkbox/strike still indicate completion.
            style={{ color: chrome.foreground, textDecorationLine: task.isDone ? "line-through" : "none" }}
          >
            {task.description}
          </Text>
          {state && <>
            <Text style={{ color: statusColor, fontSize: 11 }}>{state.label}</Text>
            {state.scheduled && <Text style={{ color: secondaryText, fontSize: 10 }}>Planned: {formatRange(state.scheduled.plannedStart, state.scheduled.plannedEnd)}</Text>}
            {task.isDone && state.scheduled?.completedAt && <Text style={{ color: secondaryText, fontSize: 10 }}>Completed: {state.scheduled.completedAt}</Text>}
          </>}
          </View>
          {editable && (
            <Pressable onPress={(event) => { event.stopPropagation(); void removeTask(task.id); }} disabled={busy} accessibilityLabel={`Delete ${task.description}`} hitSlop={8}>
              <Ionicons name="close" size={14} color={secondaryText} />
            </Pressable>
          )}
        </Pressable>
      ); })}

      {phase.tasks.length === 0 && <Text className="text-xs" style={{ color: secondaryText }}>No checklist items yet.</Text>}
      {phase.tasks.length > 0 && visibleTasks.length === 0 && <Text className="text-xs" style={{ color: secondaryText }}>No tasks in this filter for this phase.</Text>}

      {editable && (
        <View className="flex-row gap-2 mt-1" style={{ alignItems: "center" }}>
          <View className="flex-1">
            <Field
              label=""
              value={newTask}
              onChangeText={setNewTask}
              placeholder="e.g. Land filling"
              placeholderTextColor={secondaryText}
              style={{ minHeight: 44, backgroundColor: chrome.card, borderColor: secondaryText }}
              onSubmitEditing={addTask}
              returnKeyType="done"
            />
          </View>
          <Pressable
            onPress={addTask}
            disabled={adding}
            accessibilityRole="button" accessibilityLabel={`Add task to ${phase.name}`}
            className="px-3 items-center justify-center rounded-xl bg-primary"
            style={{ opacity: adding ? 0.6 : 1, height: 44, flexShrink: 0 }}
          >
            <Ionicons name="add" size={16} color="#0f1117" />
          </Pressable>
        </View>
      )}

      </>}
      {dialog}
    </View>
  );
}

/**
 * Lets whoever manages this project's checklist — an assigned contractor, or the homeowner
 * themselves on a small project with no contractor assigned — check off tasks per phase and submit
 * the project as finished. Explicit read-only mode reuses the same records for
 * authorized project viewers; server-side permissions remain authoritative.
 */
export default function ProjectChecklistCard({
  project,
  onChanged,
  readOnly = false,
  collapsible = false,
  drawer = false,
  timeline,
}: {
  project: DashboardProject;
  onChanged: () => Promise<void>;
  readOnly?: boolean;
  collapsible?: boolean;
  drawer?: boolean;
  timeline?: ProjectTimeline | null;
}) {
  const { chrome, mode } = useTheme();
  const secondaryText = mode === "light" ? chrome.mutedForeground : chrome.secondaryForeground;
  const [busyAction, setBusyAction] = useState<"finish" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const { ask, dialog } = useConfirmDialog();
  const [expanded, setExpanded] = useState(!drawer);
  const [filter, setFilter] = useState<ChecklistFilter>("All");

  const finishLock = useRef(false);
  if (!project.canManageChecklist && !readOnly) return null;

  const { states, counts } = checklistStates(project, timeline);
  const checklist = project.checklist ?? { totalTasks: counts.All, doneTasks: counts.Done, pct: null };
  const editable = !!project.canManageChecklist && !readOnly && !project.checklistLocked && project.status === "active" && !project.completion?.confirmedAt;

  const runFinish = async () => {
    if (!editable || !project.canSubmitCompletion || busyAction || finishLock.current) return;
    finishLock.current = true;
    setBusyAction("finish");
    setActionError(null);
    try {
      await submitProjectCompletion(project.id);
      await onChanged();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "That didn't go through. Please try again.");
    } finally {
      finishLock.current = false;
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
    <View style={{ gap: drawer ? 14 : 10, ...(drawer ? { backgroundColor: chrome.card, borderColor: chrome.border, borderWidth: 1, borderRadius: 22, padding: 14 } : {}) }}>
      {drawer && <Pressable accessibilityRole="button" accessibilityLabel="Project Checklist" accessibilityState={{ expanded }}
        onPress={() => { animateAccordion(); setExpanded(value => !value); }} style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48 }}>
        <Ionicons name="checkbox-outline" size={22} color="#d97706" />
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <Text style={{ color: mode === "light" ? "#b45309" : "#fbbf24", fontSize: 16, fontWeight: "800" }}>Project Checklist</Text>
          {!expanded && <Text style={{ color: secondaryText, fontSize: 12 }}>{counts.Done} of {counts.All} tasks completed</Text>}
        </View>
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={19} color="#d97706" />
      </Pressable>}
      {expanded && <>
      {drawer && <>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled"
          style={{ flexGrow: 0, minWidth: 0 }} contentContainerStyle={{ gap: 8, paddingVertical: 2, paddingRight: 2 }}>
          {CHECKLIST_FILTERS.map(value => <Pressable key={value} accessibilityRole="button" accessibilityLabel={`${value}: ${counts[value]} tasks`} accessibilityState={{ selected: filter === value }}
            onPress={() => { animateAccordion(); setFilter(value); }} style={{ minHeight: 44, flexShrink: 0, justifyContent: "center", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 24,
              borderWidth: 1, borderColor: filter === value ? "#f59e0b" : chrome.border, backgroundColor: filter === value ? "#f59e0b" : chrome.muted }}>
            <Text style={{ color: filter === value ? "#0f1117" : chrome.foreground, fontSize: 12, fontWeight: filter === value ? "700" : "500" }}>{value} ({counts[value]})</Text>
          </Pressable>)}
        </ScrollView>
        <Text style={{ color: secondaryText, fontSize: 11, lineHeight: 16 }}>Colors follow the schedule; checkmarks show completed work.</Text>
        {!editable && <Text style={{ color: secondaryText, fontSize: 11 }}>View only.</Text>}
      </>}
      <View className={drawer ? undefined : "px-3 py-3 rounded-xl bg-muted"} style={{ gap: drawer ? 12 : 8, ...(drawer ? {
        backgroundColor: chrome.card, borderWidth: 1, borderColor: chrome.border, borderRadius: 18, padding: 16,
        shadowColor: "#000", shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 5, elevation: 1,
      } : {}) }}>
        <View className={drawer ? undefined : "flex-row items-center justify-between"} style={drawer ? { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 } : undefined}>
          <Text className="text-xs font-bold text-foreground">{drawer ? "Checklist completion" : "Project progress"}</Text>
          <Text style={{ color: drawer ? mode === "light" ? "#b45309" : "#fbbf24" : chrome.foreground, fontSize: drawer ? 16 : 12, fontWeight: "700" }}>
            {checklist.pct === null ? "Not recorded" : `${checklist.pct}%`}
          </Text>
        </View>
        {checklist.pct !== null && <ProgressBar pct={checklist.pct} color={checklist.pct === 100 ? "#10b981" : "#f59e0b"} height={10} />}
        <Text style={{ color: secondaryText, fontSize: drawer ? 13 : 12, lineHeight: drawer ? 19 : undefined }}>
          {checklist.doneTasks} of {checklist.totalTasks} {checklist.totalTasks === 1 ? "task" : "tasks"} completed
        </Text>
      </View>

      {actionError ? <Text className="text-xs text-danger">{actionError}</Text> : null}

      {project.phases.map((phase) => (
        <PhaseChecklist key={phase.id} projectId={project.id} editable={editable} phase={phase} onChanged={onChanged} collapsible={collapsible || drawer}
          initiallyExpanded={!drawer} filter={filter} states={drawer ? states : undefined} modern={drawer} />
      ))}
      {!project.phases.length && <Text style={{ color: secondaryText, fontSize: 12 }}>No construction phases or checklist records are available yet.</Text>}

      {editable && (
        <View style={{ gap: 6 }}>
          <Button
            label={busyAction === "finish" ? "Submitting…" : "Mark Project as Finished"}
            disabled={!project.canSubmitCompletion || busyAction !== null}
            onPress={confirmFinish}
          />
          {!project.canSubmitCompletion && (
            <Text className="text-xs" style={{ color: secondaryText }}>
              {checklist.totalTasks === 0
                ? "Add checklist tasks to be able to finish this project."
                : "Complete every checklist task to enable this button."}
            </Text>
          )}
        </View>
      )}
      </>}
      {dialog}
    </View>
  );
}
