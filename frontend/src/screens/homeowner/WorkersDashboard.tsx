import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/components/ui";
import TeamActivity from "@/components/TeamActivity";
import TeamProfileDetails from "@/components/homeowner/TeamProfileDetails";
import PendingTeamApplications from "@/components/homeowner/PendingTeamApplications";
import WorkersDirectory from "@/components/homeowner/WorkersDirectory";
import { Action, OverviewBanner, BuildTeamBanner, CurrentTeamCard, RecommendedWorkerCard, WorkersSectionTitle } from "@/components/homeowner/WorkersTabUI";
import { usePlan } from "@/context/PlanContext";
import { useTheme } from "@/context/ThemeContext";
import { useFocusedResource } from "@/hooks/useFocusedResource";
import { fetchHomeownerTeam, type HomeownerTeamMember, type HomeownerTeamOverview } from "@/services/api/homeownerTeam";
import { assignWorkerToProject } from "@/services/api/projects";
import { searchWorkers } from "@/services/api/workers";
import { recommendedSkillsForPlan } from "@/utils/teamRecommendations";
import { workersLayout } from "@/utils/workersLayout";
import type { WorkerSearchResult } from "@/types/worker";

const ORANGE = "#f59e0b";
const PREVIEW_SIZE = 3;
interface TeamData { overview: HomeownerTeamOverview | null; recommendations: WorkerSearchResult[]; recommendationError: string | null; requestedAt: number }

export default function WorkersDashboard() {
  const { activeProjectKey, ready, refreshProjectSelection } = usePlan();
  const { chrome } = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const layout = workersLayout(width, fontScale);
  const [showMetricInfo, setShowMetricInfo] = useState(false);
  const projectId = /^[1-9]\d*$/.test(activeProjectKey) ? Number(activeProjectKey) : null;
  const load = useCallback(async (): Promise<TeamData> => {
    const requestedAt = Date.now();
    if (!projectId) return { overview: null, recommendations: [], recommendationError: null, requestedAt };
    const overview = await fetchHomeownerTeam(projectId);
    const approved = overview.approvedPlan;
    const skills = approved ? recommendedSkillsForPlan({ ...approved, budgetBreakdown: approved.budgetBreakdown ?? [], phases: approved.phases ?? [] } as Parameters<typeof recommendedSkillsForPlan>[0]).filter(skill => skill.length <= 50).slice(0, 20) : [];
    if (!overview.canInvite || !skills.length) return { overview, recommendations: [], recommendationError: null, requestedAt };
    try {
      // Same approved-worker ranking as Find Your Team, grounded in this server-approved plan.
      const workers = await searchWorkers({ skills });
      const joined = new Set(overview.team.filter(member => member.role === "worker").map(member => member.id));
      return { overview, recommendations: workers.filter(worker => worker.matchedSkillCount > 0 && !joined.has(worker.id)), recommendationError: null, requestedAt };
    } catch {
      return { overview, recommendations: [], recommendationError: "Could not refresh recommended workers. Your current team is still available.", requestedAt };
    }
  }, [projectId]);
  const { data, loading, error, refresh } = useFocusedResource(load, ready);
  // Never render a previous project's snapshot, even before focus-effect cleanup runs.
  const overview = ready && data?.overview?.projectId === projectId ? data.overview : null;
  const [expanded, setExpanded] = useState(false);
  const [profile, setProfile] = useState<Pick<HomeownerTeamMember, "id" | "name" | "role"> | null>(null);
  const [activity, setActivity] = useState(false);
  const [sending, setSending] = useState<number[]>([]);
  const [sent, setSent] = useState<Record<number, number>>({});
  const [inviteError, setInviteError] = useState<string | null>(null);
  const locks = useRef(new Set<number>());
  const identity = useRef<string | null>(activeProjectKey);
  useEffect(() => { identity.current = ready ? activeProjectKey : null; return () => { identity.current = null; }; }, [activeProjectKey, ready]);
  const pending = new Map(overview?.pendingWorkers.map(request => [request.workerId, request.initiatedBy]));
  // A successful invite is real server data. Retain it while an older snapshot/failed refresh is displayed.
  const newInvites = Object.entries(sent).filter(([id, at]) => at >= (data?.requestedAt ?? 0) && !pending.has(Number(id)) && !overview?.team.some(member => member.role === "worker" && member.id === Number(id)));
  newInvites.forEach(([id]) => pending.set(Number(id), "homeowner"));
  const invite = async (workerId: number) => {
    if (!ready || !overview?.canInvite || !projectId || locks.current.has(workerId) || pending.has(workerId)) return;
    const key = activeProjectKey;
    locks.current.add(workerId); setSending(previous => [...previous, workerId]); setInviteError(null);
    try {
      await assignWorkerToProject(projectId, workerId);
      if (identity.current !== key) return;
      setSent(previous => ({ ...previous, [workerId]: Date.now() }));
      await refresh();
    } catch (failure) {
      if (identity.current === key) setInviteError(failure instanceof Error ? failure.message : "Could not send the invitation. Please retry.");
    } finally {
      locks.current.delete(workerId);
      if (identity.current === key) setSending(previous => previous.filter(id => id !== workerId));
    }
  };
  const browse = () => router.push("/homeowner/find-team" as never);
  const card = [styles.card, { backgroundColor: chrome.card, borderColor: chrome.border }];
  if (!ready || !projectId || overview?.status === "not_started") return <WorkersDirectory />;
  if (loading && !overview) return <View className="flex-1 items-center justify-center bg-background"><ActivityIndicator accessibilityLabel="Loading selected project team" color={ORANGE} /></View>;
  if (!overview) return <WorkersDirectory teamError={error} onRetryTeam={() => { void refresh(); void refreshProjectSelection(); }} />;
  const team = expanded ? overview.team : overview.team.slice(0, PREVIEW_SIZE);
  const recommendations = data?.recommendations ?? [];
  const rows: WorkerSearchResult[][] = [];
  for (let index = 0; index < recommendations.length; index += layout.recommendationColumns) {
    rows.push(recommendations.slice(index, index + layout.recommendationColumns));
  }
  return <Screen topInset={false}>
    <OverviewBanner overview={overview} pendingCount={overview.metrics.pending + newInvites.length} columns={layout.statsColumns}
      showInfo={showMetricInfo} onInfo={() => setShowMetricInfo(value => !value)} />
    <BuildTeamBanner canInvite={overview.canInvite} onBrowse={browse} />
    <PendingTeamApplications key={overview.projectId} projectId={overview.projectId} onChanged={refresh} />
    {error && <Text accessibilityRole="alert" style={{ color: "#ef4444" }}>{error}</Text>}
    <WorkersSectionTitle action={overview.team.length > PREVIEW_SIZE ?
      <Action label={expanded ? "Show Less" : "View All"} icon="chevron-forward" onPress={() => setExpanded(value => !value)} /> : undefined}>
      Current Team ({overview.team.length})
    </WorkersSectionTitle>
    {!team.length && <View style={[...card, { padding: 14, gap: 9 }]}>
      <Text style={{ color: chrome.foreground, fontWeight: "700", fontSize: 14 }}>No team members yet</Text>
      <Text style={{ color: chrome.secondaryForeground, fontSize: 12, lineHeight: 18 }}>Start building your construction team by browsing available skilled workers.</Text>
      {overview.canInvite && <Action label="Browse Skilled Workers" icon="arrow-forward" onPress={browse} />}
    </View>}
    {team.map(member => <CurrentTeamCard key={`${member.role}-${member.id}`} member={member} projectId={overview.projectId} inline={layout.inlineTeam}
      onView={() => setProfile(member)} onAssignment={() => setActivity(value => !value)} isCurrent={() => identity.current === activeProjectKey} />)}
    {activity && <View style={[...card, { padding: 14, gap: 8 }]}>
      <Text style={{ color: chrome.foreground, fontSize: 16, fontWeight: "800" }}>Project Team Activity</Text>
      <Text style={{ color: chrome.secondaryForeground, fontSize: 12 }}>Recorded attendance and work logs for {overview.title}. Individual schedules are not recorded.</Text>
      <TeamActivity key={overview.projectId} projectId={overview.projectId} />
    </View>}
    <View style={{ gap: 4 }}><WorkersSectionTitle>Recommended Workers for Your Project</WorkersSectionTitle>
      <Text style={{ color: chrome.secondaryForeground, fontSize: 11.5 }}>AI-powered suggestions based on your project needs.</Text>
    </View>
    {inviteError && <Text accessibilityRole="alert" style={{ color: "#ef4444" }}>{inviteError}</Text>}
    {data?.recommendationError && <View style={{ gap: 8 }}><Text accessibilityRole="alert" style={{ color: "#ef4444" }}>{data.recommendationError}</Text><Action label="Retry recommendations" onPress={() => void refresh()} /></View>}
    {!recommendations.length && !data?.recommendationError && <View style={[...card, { padding: 14 }]}><Text style={{ color: chrome.secondaryForeground, fontSize: 12 }}>No recommendations available yet</Text></View>}
    {rows.map((row, index) => <View key={index} style={{ flexDirection: "row", gap: 10, alignItems: "stretch" }}>
      {row.map(worker => <View key={worker.id} style={{ flex: 1, minWidth: 0 }}><RecommendedWorkerCard worker={worker}
        inviteLabel={sending.includes(worker.id) ? "Sending…" : pending.has(worker.id) ? pending.get(worker.id) === "worker" ? "Application Pending" : "Invite Sent" : "Invite"}
        disabled={!overview.canInvite || sending.includes(worker.id) || pending.has(worker.id)} onInvite={() => void invite(worker.id)} onView={() => setProfile({ ...worker, role: "worker" })} />
      </View>)}
      {row.length < layout.recommendationColumns && <View style={{ flex: 1 }} />}
    </View>)}
    {profile && <TeamProfileDetails key={`${overview.projectId}-${profile.role}-${profile.id}`} member={profile} onClose={() => setProfile(null)} />}
  </Screen>;
}
const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 18, padding: 14, shadowColor: "#000", shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 1 },
});
