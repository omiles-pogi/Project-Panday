import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Card, Field, PageHeader, Screen, SubmitButton } from "@/components/ui";
import Sheet from "@/components/Sheet";
import { useTheme } from "@/context/ThemeContext";
import { applyAsContractor, fetchAvailableProjectsForContractors } from "@/services/api/projects";
import type { AvailableProject } from "@/types/project";
import { peso } from "@/utils/currency";

const STATUS_META: Record<"pending" | "approved" | "rejected", { label: string; color: string }> = {
  pending: { label: "Pending", color: "#f59e0b" },
  approved: { label: "Approved", color: "#10b981" },
  rejected: { label: "Rejected", color: "#ef4444" },
};

function ApplySheet({
  project,
  onClose,
  onApplied,
}: {
  project: AvailableProject;
  onClose: () => void;
  onApplied: (projectId: number) => void;
}) {
  const [quoteAmount, setQuoteAmount] = useState("");
  const [estimatedDays, setEstimatedDays] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await applyAsContractor(project.id, {
        quoteAmount: quoteAmount ? Number(quoteAmount) : undefined,
        estimatedDays: estimatedDays ? Number(estimatedDays) : undefined,
        message: message.trim() || undefined,
      });
      onApplied(project.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit your application.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet visible title="Apply for this project" subtitle={project.title} onClose={onClose}>
      <Field
        label="Your quote (₱, optional)"
        value={quoteAmount}
        onChangeText={setQuoteAmount}
        keyboardType="numeric"
        placeholder="e.g. 2300000"
      />
      <Field
        label="Estimated completion (days, optional)"
        value={estimatedDays}
        onChangeText={setEstimatedDays}
        keyboardType="numeric"
        placeholder="e.g. 180"
      />
      <Field
        label="Message to the homeowner (optional)"
        value={message}
        onChangeText={setMessage}
        multiline
        placeholder="Describe your approach, availability, or anything else relevant."
      />
      {error && <Text className="text-xs text-danger">{error}</Text>}
      <SubmitButton label={submitting ? "Submitting…" : "Submit Application"} onPress={submit} />
    </Sheet>
  );
}

function ProjectCard({
  project,
  onApplied,
}: {
  project: AvailableProject;
  onApplied: (projectId: number) => void;
}) {
  const { chrome } = useTheme();
  const [applying, setApplying] = useState(false);
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
          onPress={() => setApplying(true)}
          className="flex-row items-center justify-center gap-1.5 py-2.5 rounded-xl bg-primary"
        >
          <Ionicons name="paper-plane-outline" size={15} color="#0f1117" />
          <Text className="text-xs font-bold text-primary-foreground">Apply</Text>
        </Pressable>
      )}

      {applying && <ApplySheet project={project} onClose={() => setApplying(false)} onApplied={onApplied} />}
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
      fetchAvailableProjectsForContractors()
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
      <PageHeader title="Available Projects" subtitle="Homeowner-posted projects open for contractor proposals." />

      {error && <Text className="text-xs text-danger px-1">{error}</Text>}

      {!error && projects === null && (
        <View className="items-center py-10">
          <ActivityIndicator color="#f59e0b" />
        </View>
      )}

      {projects !== null && projects.length === 0 && (
        <Text className="text-sm text-center text-muted-foreground py-10">
          No other active projects right now. Check back later, or wait for a homeowner to invite you from Find
          Your Team.
        </Text>
      )}

      {projects?.map((p) => (
        <ProjectCard key={p.id} project={p} onApplied={handleApplied} />
      ))}
    </Screen>
  );
}
