import { useCallback, useState } from "react";
import { ScrollView, Text, View, Pressable, ActivityIndicator } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { fetchDashboard } from "@/services/api/projects";
import type { DashboardData } from "@/types/project";
import { peso } from "@/utils/currency";

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

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      setError(null);
      fetchDashboard()
        .then((result) => {
          if (!cancelled) setData(result);
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
    }, [])
  );

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

  if (!project) {
    return (
      <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 16, paddingBottom: 96, gap: 16 }}>
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
    );
  }

  const pct = project.overallProgressPct;
  const status = progressLabel(pct);
  const remaining = project.budget - project.totalEstimate;

  const budgetPills = [
    { label: "Your Budget", value: peso(project.budget), color: "#9ca3af" },
    { label: "AI Estimate", value: peso(project.totalEstimate), color: "#f59e0b" },
    { label: "Remaining", value: peso(remaining), color: remaining >= 0 ? "#10b981" : "#ef4444" },
  ];

  return (
    <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 16, paddingBottom: 96, gap: 16 }}>
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
          <View className="w-16 h-16 items-center justify-center">
            <Svg width={64} height={64} viewBox="0 0 36 36" style={{ transform: [{ rotate: "-90deg" }] }}>
              <Circle cx="18" cy="18" r="15.9" fill="none" stroke="#252a3a" strokeWidth={3} />
              <Circle
                cx="18"
                cy="18"
                r="15.9"
                fill="none"
                stroke="#f59e0b"
                strokeWidth={3}
                strokeDasharray={`${pct} ${100 - pct}`}
                strokeLinecap="round"
              />
            </Svg>
            <View style={{ position: "absolute" }}>
              <Text className="text-sm font-extrabold text-foreground">{pct}%</Text>
            </View>
          </View>
        </View>

        <View className="flex-row flex-wrap gap-2 mb-4">
          {budgetPills.map(({ label, value, color }) => (
            <View key={label} className="px-3 py-2.5 rounded-2xl bg-background" style={{ width: "31%" }}>
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
          <View className="h-2.5 rounded-full overflow-hidden bg-muted">
            <View className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
          </View>
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
          {project.phases.map(({ name, progressPct }) => (
            <View key={name}>
              <View className="flex-row justify-between mb-1.5">
                <Text className="text-xs text-muted-foreground">{name}</Text>
                <Text
                  className="text-xs font-semibold"
                  style={{ color: progressPct === 100 ? "#10b981" : progressPct > 0 ? "#f59e0b" : "#374151" }}
                >
                  {progressPct}%
                </Text>
              </View>
              <View className="h-2 rounded-full overflow-hidden bg-muted">
                <View
                  className="h-full rounded-full"
                  style={{
                    width: `${progressPct}%`,
                    backgroundColor:
                      progressPct === 100 ? "#10b981" : progressPct > 50 ? "#f59e0b" : progressPct > 0 ? "#3b82f6" : "#252a3a",
                  }}
                />
              </View>
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
              </View>
            ))}
            {project.workers.map((w) => (
              <View key={`worker-${w.id}`} className="flex-row items-center gap-3 px-3 py-2.5 rounded-xl bg-muted">
                <Ionicons name="hammer-outline" size={16} color="#f59e0b" />
                <View className="flex-1">
                  <Text className="text-xs font-medium text-foreground">{w.name}</Text>
                  <Text className="text-xs text-muted-foreground">{w.trade || "Worker"}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
