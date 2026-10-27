import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Card, PageHeader, Screen } from "@/components/ui";
import { useTheme } from "@/context/ThemeContext";
import { applyToProject, fetchAvailableProjects } from "@/services/api/projects";
import type { AvailableProject } from "@/types/project";
import { peso } from "@/utils/currency";

const STATUS_META: Record<"pending" | "approved" | "rejected", { label: string; color: string }> = {
  pending: { label: "Pending", color: "#f59e0b" },
  approved: { label: "Approved", color: "#10b981" },
  rejected: { label: "Rejected", color: "#ef4444" },
};

function ProjectCard({
  project,
  onApplied,
}: {
  project: AvailableProject;
  onApplied: (projectId: number) => void;
}) {
  const { chrome } = useTheme();
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apply = async () => {
    setApplying(true);
    setError(null);
    try {
      await applyToProject(project.id);
      onApplied(project.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply. Please try again.");
    } finally {
      setApplying(false);
    }
  };

  const status = project.myApplicationStatus;

  return (
    <Card>
      <View className="flex-row items-start justify-between mb-3">
        <View className="flex-1 pr-3">
          <Text className="font-bold text-base text-foreground mb-1">{project.title}</Text>
          <Text className="text-xs text-muted-foreground">
            {project.ownerName}
            {project.location ? ` · ${project.location}` : ""}
          </Text>
        </View>
        <View className="items-end">
          <Text className="text-base font-bold" style={{ color: "#f59e0b" }}>
            {project.overallProgressPct}%
          </Text>
          <Text className="text-xs text-muted-foreground">Progress</Text>
        </View>
      </View>

      <View className="flex-row flex-wrap gap-2 mb-3">
        <View className="p-3 rounded-xl bg-muted" style={{ flexGrow: 1, flexBasis: "28%" }}>
          <Text className="text-xs mb-1 text-muted-foreground">Budget</Text>
          <Text className="text-xs font-medium text-foreground">{peso(project.budget)}</Text>
        </View>
        <View className="p-3 rounded-xl bg-muted" style={{ flexGrow: 1, flexBasis: "28%" }}>
          <Text className="text-xs mb-1 text-muted-foreground">Timeline</Text>
          <Text className="text-xs font-medium text-foreground">{project.timelineMonths} months</Text>
        </View>
        <View className="p-3 rounded-xl bg-muted" style={{ flexGrow: 1, flexBasis: "28%" }}>
          <Text className="text-xs mb-1 text-muted-foreground">Started</Text>
          <Text className="text-xs font-medium text-foreground">{new Date(project.startedAt).toLocaleDateString()}</Text>
        </View>
      </View>

      <View className="flex-row items-center gap-4 px-1 mb-3">
        <View className="flex-row items-center gap-1.5">
          <Ionicons name="hammer-outline" size={13} color={chrome.mutedForeground} />
          <Text className="text-xs text-muted-foreground">
            {project.workerCount} worker{project.workerCount === 1 ? "" : "s"} assigned
          </Text>
        </View>
        <View className="flex-row items-center gap-1.5">
          <Ionicons name="business-outline" size={13} color={chrome.mutedForeground} />
          <Text className="text-xs text-muted-foreground">
            {project.contractorCount} contractor{project.contractorCount === 1 ? "" : "s"} assigned
          </Text>
        </View>
      </View>

      {error && <Text className="text-xs text-danger mb-2">{error}</Text>}

      {status ? (
        <View
          className="flex-row items-center justify-center gap-1.5 py-2 rounded-xl"
          style={{ backgroundColor: `${STATUS_META[status].color}20` }}
        >
          <Ionicons
            name={status === "approved" ? "checkmark-circle" : status === "rejected" ? "close-circle" : "time-outline"}
            size={15}
            color={STATUS_META[status].color}
          />
          <Text className="text-xs font-semibold" style={{ color: STATUS_META[status].color }}>
            Application {STATUS_META[status].label}
          </Text>
        </View>
      ) : (
        <Pressable
          onPress={apply}
          disabled={applying}
          className="flex-row items-center justify-center gap-1.5 py-2.5 rounded-xl bg-primary"
          style={{ opacity: applying ? 0.6 : 1 }}
        >
          {applying ? (
            <ActivityIndicator size="small" color="#0f1117" />
          ) : (
            <>
              <Ionicons name="paper-plane-outline" size={15} color="#0f1117" />
              <Text className="text-xs font-bold text-primary-foreground">Apply</Text>
            </>
          )}
        </Pressable>
      )}
    </Card>
  );
}

export default function AvailableProjects() {
  const [projects, setProjects] = useState<AvailableProject[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setError(null);
      fetchAvailableProjects()
        .then((data) => {
          if (!cancelled) setProjects(data);
        })
        .catch((err) => {
          if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load projects.");
        });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const handleApplied = (projectId: number) => {
    setProjects((list) => list?.map((p) => (p.id === projectId ? { ...p, myApplicationStatus: "pending" } : p)) ?? list);
  };

  return (
    <Screen>
      <PageHeader title="Available Projects" subtitle="Active projects homeowners have posted — apply to join one." />

      {error && <Text className="text-xs text-danger px-1">{error}</Text>}

      {!error && projects === null && (
        <View className="items-center py-10">
          <ActivityIndicator color="#f59e0b" />
        </View>
      )}

      {projects !== null && projects.length === 0 && (
        <Text className="text-sm text-center text-muted-foreground py-10">
          No other active projects right now. Check back later, or wait for a homeowner to add you to one from
          Find Your Team.
        </Text>
      )}

      {projects?.map((p) => (
        <ProjectCard key={p.id} project={p} onApplied={handleApplied} />
      ))}
    </Screen>
  );
}
