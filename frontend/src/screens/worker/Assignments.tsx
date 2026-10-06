import { useCallback, useState } from "react";
import { Text, View, Pressable, ActivityIndicator } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Badge, Card, PageHeader, Screen } from "@/components/ui";
import { fetchMyProjects } from "@/services/api/projects";
import type { MyProject } from "@/types/project";

function ProjectCard({ project }: { project: MyProject }) {
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
        <View className="flex-row items-center justify-center gap-1 py-1">
          <Text className="text-xs font-medium text-primary">{expanded ? "Hide phases" : "View phases"}</Text>
          <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={14} color="#f59e0b" />
        </View>
      </Pressable>

      {expanded && (
        <View style={{ gap: 10 }} className="mt-2">
          {project.phases.map((phase) => (
            <View key={phase.id} className="px-3 py-3 rounded-xl bg-muted" style={{ gap: 8 }}>
              <View className="flex-row justify-between items-center">
                <Text className="text-xs font-semibold text-foreground">{phase.name}</Text>
                <Text className="text-xs" style={{ color: phase.progressPct === 100 ? "#10b981" : "#f59e0b" }}>
                  {phase.progressPct}%
                </Text>
              </View>
              {phase.tasks.map((task) => (
                <View key={task.id} className="flex-row items-center gap-2">
                  <Ionicons
                    name={task.isDone ? "checkbox" : "square-outline"}
                    size={16}
                    color={task.isDone ? "#10b981" : "#9ca3af"}
                  />
                  <Text
                    className="flex-1 text-xs"
                    style={{
                      color: task.isDone ? "#10b981" : "#e8eaed",
                      textDecorationLine: task.isDone ? "line-through" : "none",
                    }}
                  >
                    {task.description}
                  </Text>
                </View>
              ))}
              {phase.tasks.length === 0 && <Text className="text-xs text-muted-foreground">No checklist items yet.</Text>}
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

export default function Assignments() {
  const [projects, setProjects] = useState<MyProject[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchMyProjects()
      .then(setProjects)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load assignments."));
  }, []);

  useFocusEffect(load);

  return (
    <Screen>
      <PageHeader title="My Assignments" subtitle="Projects you're assigned to and their reported progress." />

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
        <ProjectCard key={project.id} project={project} />
      ))}
    </Screen>
  );
}
