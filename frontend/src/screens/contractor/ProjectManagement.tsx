import { useCallback, useState } from "react";
import { Text, View, Pressable, ActivityIndicator } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Badge, Card, Field, PageHeader, Screen } from "@/components/ui";
import { addPhaseTask, deletePhaseTask, fetchMyProjects, togglePhaseTask } from "@/services/api/projects";
import type { MyProject } from "@/types/project";
import { peso } from "@/utils/currency";

function PhaseChecklist({
  project,
  phase,
  onChanged,
}: {
  project: MyProject;
  phase: MyProject["phases"][number];
  onChanged: () => void;
}) {
  const [newTask, setNewTask] = useState("");
  const [adding, setAdding] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState<number | null>(null);

  const addTask = async () => {
    const description = newTask.trim();
    if (!description) return;
    setAdding(true);
    try {
      await addPhaseTask(project.id, phase.id, description);
      setNewTask("");
      onChanged();
    } catch {
      // Leave input filled so the user can retry.
    } finally {
      setAdding(false);
    }
  };

  const toggleTask = async (taskId: number, isDone: boolean) => {
    setBusyTaskId(taskId);
    try {
      await togglePhaseTask(project.id, phase.id, taskId, isDone);
      onChanged();
    } catch {
      // Ignore; UI will just reflect the unchanged state.
    } finally {
      setBusyTaskId(null);
    }
  };

  const removeTask = async (taskId: number) => {
    setBusyTaskId(taskId);
    try {
      await deletePhaseTask(project.id, phase.id, taskId);
      onChanged();
    } catch {
      // no-op
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

      {phase.tasks.map((task) => (
        <Pressable
          key={task.id}
          onPress={() => (project.canManageChecklist ? toggleTask(task.id, !task.isDone) : undefined)}
          className="flex-row items-center gap-2"
          disabled={busyTaskId === task.id}
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
          {project.canManageChecklist && (
            <Pressable onPress={() => removeTask(task.id)} hitSlop={8}>
              <Ionicons name="close" size={14} color="#6b7280" />
            </Pressable>
          )}
        </Pressable>
      ))}

      {phase.tasks.length === 0 && <Text className="text-xs text-muted-foreground">No checklist items yet.</Text>}

      {project.canManageChecklist && (
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
    </View>
  );
}

function ProjectCard({ project, onChanged }: { project: MyProject; onChanged: () => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card>
      <Pressable onPress={() => setExpanded((e) => !e)}>
        <View className="flex-row items-start justify-between mb-2">
          <View className="flex-1 pr-3" style={{ gap: 4 }}>
            <Text className="font-bold text-sm text-foreground">{project.title}</Text>
            <Badge label={project.status === "completed" ? "Completed" : "Active"} color={project.status === "completed" ? "#10b981" : "#f59e0b"} />
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
          <View className="p-2.5 rounded-xl bg-muted" style={{ width: "48%" }}>
            <Text className="text-xs mb-0.5 text-muted-foreground">Budget</Text>
            <Text className="text-xs font-medium text-foreground">{peso(project.budget)}</Text>
          </View>
          <View className="p-2.5 rounded-xl bg-muted" style={{ width: "48%" }}>
            <Text className="text-xs mb-0.5 text-muted-foreground">AI Estimate</Text>
            <Text className="text-xs font-medium text-foreground">{peso(project.totalEstimate)}</Text>
          </View>
        </View>
        <View className="flex-row items-center justify-center gap-1 py-1">
          <Text className="text-xs font-medium text-primary">{expanded ? "Hide checklist" : "Manage checklist"}</Text>
          <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={14} color="#f59e0b" />
        </View>
      </Pressable>

      {expanded && (
        <View style={{ gap: 10 }} className="mt-2">
          {project.phases.map((phase) => (
            <PhaseChecklist key={phase.id} project={project} phase={phase} onChanged={onChanged} />
          ))}
        </View>
      )}
    </Card>
  );
}

export default function ProjectManagement() {
  const [projects, setProjects] = useState<MyProject[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchMyProjects()
      .then(setProjects)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load projects."));
  }, []);

  useFocusEffect(load);

  return (
    <Screen>
      <PageHeader title="My Projects" subtitle="Projects you're assigned to. Check off work as it's completed." />

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
        <ProjectCard key={project.id} project={project} onChanged={load} />
      ))}
    </Screen>
  );
}
