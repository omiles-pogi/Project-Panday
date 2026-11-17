import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import TeamActivity from "@/components/TeamActivity";
import TeamProfileDetails from "@/components/homeowner/TeamProfileDetails";
import PendingTeamApplications from "@/components/homeowner/PendingTeamApplications";
import WorkersDirectory from "@/components/homeowner/WorkersDirectory";
import { Action, OverviewBanner, CurrentTeamCard, RecommendedWorkerCard, WorkersSectionTitle } from "@/components/homeowner/WorkersTabUI";
import { usePlan } from "@/context/PlanContext";
import { useTheme } from "@/context/ThemeContext";
import { useFocusedResource } from "@/hooks/useFocusedResource";
import { fetchHomeownerTeam, type HomeownerTeamMember, type HomeownerTeamOverview } from "@/services/api/homeownerTeam";
import { assignWorkerToProject, assignContractorToProject } from "@/services/api/projects";
import { workersLayout } from "@/utils/workersLayout";
import type { WorkerSearchResult } from "@/types/worker";
import type { ContractorSearchResult } from "@/types/contractor";

const ORANGE = "#f59e0b";
const PREVIEW_SIZE = 3;
type Recommendation = { role: "worker"; person: WorkerSearchResult } | { role: "contractor"; person: ContractorSearchResult };
interface TeamData { overview: HomeownerTeamOverview | null; recommendations: WorkerSearchResult[]; contractorRecommendations: ContractorSearchResult[]; recommendationError: string | null; requestedAt: number }

export default function WorkersDashboard() {
  const { activeProjectKey, ready, refreshProjectSelection } = usePlan();
  const { chrome } = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const layout = workersLayout(width, fontScale);
  const [showMetricInfo, setShowMetricInfo] = useState(false);
  const projectId = /^[1-9]\d*$/.test(activeProjectKey) ? Number(activeProjectKey) : null;
  const load = useCallback(async (): Promise<TeamData> => {
    const requestedAt = Date.now();
    if (!projectId) return { overview: null, recommendations: [], contractorRecommendations: [], recommendationError: null, requestedAt };
    const overview = await fetchHomeownerTeam(projectId);
    const matches = overview.recommendations;
    if ((overview.status !== "active" && overview.status !== "pending_confirmation") || !overview.canInvite || !overview.approvedPlan) return { overview, recommendations: [], contractorRecommendations: [], recommendationError: null, requestedAt };
    // Reuse the same server-owned project matching as Find Your Team. The general
    // directory still uses its independent, unfiltered browsing endpoints.
    const valid = matches?.projectId === projectId && matches.planApproved;
    const joinedWorkers = new Set(overview.team.filter(member => member.role === "worker").map(member => member.id));
    const joinedContractors = new Set(overview.team.filter(member => member.role === "contractor").map(member => member.id));
    return {
      overview, requestedAt,
      recommendations: valid ? matches.workers.filter(worker => !joinedWorkers.has(worker.id)) : [],
      contractorRecommendations: valid ? matches.contractors.filter(contractor => !joinedContractors.has(contractor.id)) : [],
      recommendationError: !matches ? "Could not refresh recommended workers and contractors. Your current team is still available." : null,
    };
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
  const contractorLocks = useRef(new Set<number>());
  const [sendingContractors, setSendingContractors] = useState<number[]>([]);
  const [sentContractors, setSentContractors] = useState<Record<number, number>>({});
  const identity = useRef<string | null>(activeProjectKey);
  useEffect(() => { identity.current = ready ? activeProjectKey : null; return () => { identity.current = null; }; }, [activeProjectKey, ready]);
  const pending = new Map(overview?.pendingWorkers.map(request => [request.workerId, request.initiatedBy]));
  // A successful invite is real server data. Retain it while an older snapshot/failed refresh is displayed.
  const newInvites = Object.entries(sent).filter(([id, at]) => at >= (data?.requestedAt ?? 0) && !pending.has(Number(id)) && !overview?.team.some(member => member.role === "worker" && member.id === Number(id)));
  newInvites.forEach(([id]) => pending.set(Number(id), "homeowner"));
  const pendingContractors = new Set(overview?.pendingContractorIds);
  const newContractorInvites = Object.entries(sentContractors).filter(([id, at]) => at >= (data?.requestedAt ?? 0) && !pendingContractors.has(Number(id)) && !overview?.team.some(member => member.role === "contractor" && member.id === Number(id)));
  newContractorInvites.forEach(([id]) => pendingContractors.add(Number(id)));
  const invite = async (workerId: number) => {
    if (!ready || !overview?.canInvite || !projectId || locks.current.has(workerId) || pending.has(workerId) || overview.team.some(member => member.role === "worker" && member.id === workerId)) return;
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
  const inviteContractor = async (contractorId: number) => {
    if (!ready || !overview?.canInvite || !projectId || contractorLocks.current.has(contractorId) || pendingContractors.has(contractorId) || overview.team.some(member => member.role === "contractor" && member.id === contractorId)) return;
    const key = activeProjectKey;
    contractorLocks.current.add(contractorId); setSendingContractors(previous => [...previous, contractorId]); setInviteError(null);
    try {
      await assignContractorToProject(projectId, contractorId);
      if (identity.current !== key) return;
      setSentContractors(previous => ({ ...previous, [contractorId]: Date.now() }));
      await refresh();
    } catch (failure) {
      if (identity.current === key) setInviteError(failure instanceof Error ? failure.message : "Could not send the invitation. Please retry.");
    } finally {
      contractorLocks.current.delete(contractorId);
      if (identity.current === key) setSendingContractors(previous => previous.filter(id => id !== contractorId));
    }
  };
  const browse = () => router.push("/homeowner/find-team" as never);
  const card = [styles.card, { backgroundColor: chrome.card, borderColor: chrome.border }];
  const managing = overview && (overview.status === "active" || overview.status === "pending_confirmation") ? overview : null;
  const team = managing ? expanded ? managing.team : managing.team.slice(0, PREVIEW_SIZE) : [];
  const recommendations: Recommendation[] = [
    ...(data?.recommendations ?? []).map(person => ({ role: "worker" as const, person })),
    ...(data?.contractorRecommendations ?? []).map(person => ({ role: "contractor" as const, person })),
  ];
  const groups = (["worker", "contractor"] as const).map(role => {
    const people = recommendations.filter(candidate => candidate.role === role);
    const rows: Recommendation[][] = [];
    for (let index = 0; index < people.length; index += layout.recommendationColumns) rows.push(people.slice(index, index + layout.recommendationColumns));
    return { role, rows };
  });
  // One directory stays mounted while project reads load, fail or finish. Its own
  // unfiltered APIs stay separate from the existing recommendation query.
  return <WorkersDirectory showProjectPrompt={!managing?.canInvite}
    teamError={!managing ? error : null} onRetryTeam={() => { void refresh(); void refreshProjectSelection(); }}
    beforeBanner={managing ? <OverviewBanner overview={managing} pendingCount={managing.metrics.pending + newInvites.length + newContractorInvites.length} columns={layout.statsColumns}
      showInfo={showMetricInfo} onInfo={() => setShowMetricInfo(value => !value)} /> : loading && projectId ? <ActivityIndicator accessibilityLabel="Loading selected project team" color={ORANGE} /> : null}
    renderInvite={(person, role) => {
      const assigned = managing?.team.some(member => member.role === role && member.id === person.id);
      const requested = role === "worker" ? pending.has(person.id) : pendingContractors.has(person.id);
      const submitting = role === "worker" ? sending.includes(person.id) : sendingContractors.includes(person.id);
      return <Action label={assigned ? "On Project" : submitting ? "Sending…" : requested ? "Request Pending" : "Invite to Project"}
        disabled={!managing?.canInvite || assigned || requested || submitting}
        onPress={() => { if (role === "worker") void invite(person.id); else void inviteContractor(person.id); }} />;
    }}>
    {managing && <>
    <PendingTeamApplications key={managing.projectId} projectId={managing.projectId} onChanged={refresh} />
    {error && <Text accessibilityRole="alert" style={{ color: "#ef4444" }}>{error}</Text>}
    <WorkersSectionTitle action={managing.team.length > PREVIEW_SIZE ?
      <Action label={expanded ? "Show Less" : "View All"} icon="chevron-forward" onPress={() => setExpanded(value => !value)} /> : undefined}>
      Current Team ({managing.team.length})
    </WorkersSectionTitle>
    {!team.length && <View style={[...card, { padding: 14, gap: 9 }]}>
      <Text style={{ color: chrome.foreground, fontWeight: "700", fontSize: 14 }}>No team members yet</Text>
      <Text style={{ color: chrome.secondaryForeground, fontSize: 12, lineHeight: 18 }}>Start building your construction team by browsing available skilled workers.</Text>
      {managing.canInvite && <Action label="Browse Skilled Workers" icon="arrow-forward" onPress={browse} />}
    </View>}
    {team.map(member => <CurrentTeamCard key={`${member.role}-${member.id}`} member={member} projectId={managing.projectId} inline={layout.inlineTeam}
      onView={() => setProfile(member)} onAssignment={() => setActivity(value => !value)} isCurrent={() => identity.current === activeProjectKey} />)}
    {activity && <View style={[...card, { padding: 14, gap: 8 }]}>
      <Text style={{ color: chrome.foreground, fontSize: 16, fontWeight: "800" }}>Project Team Activity</Text>
      <Text style={{ color: chrome.secondaryForeground, fontSize: 12 }}>Recorded attendance and work logs for {managing.title}. Individual schedules are not recorded.</Text>
      <TeamActivity key={managing.projectId} projectId={managing.projectId} />
    </View>}
    <View style={{ gap: 4 }}><WorkersSectionTitle>Recommended Workers for Your Project</WorkersSectionTitle>
      <Text style={{ color: chrome.secondaryForeground, fontSize: 11.5 }}>AI-powered suggestions based on your project needs.</Text>
    </View>
    {inviteError && <Text accessibilityRole="alert" style={{ color: "#ef4444" }}>{inviteError}</Text>}
    {data?.recommendationError && <View style={{ gap: 8 }}><Text accessibilityRole="alert" style={{ color: "#ef4444" }}>{data.recommendationError}</Text><Action label="Retry recommendations" onPress={() => void refresh()} /></View>}
    {!recommendations.length && !data?.recommendationError && <View style={[...card, { padding: 14 }]}><Text style={{ color: chrome.secondaryForeground, fontSize: 12 }}>No recommendations available yet</Text></View>}
    {groups.filter(group => group.rows.length > 0).map(group => <View key={group.role} style={{ gap: 10 }}>
    <Text style={{ color: chrome.foreground, fontWeight: "700", fontSize: 13 }}>{group.role === "worker" ? "Recommended Skilled Workers" : "Recommended Contractors"}</Text>
    {group.rows.map((row, index) => <View key={index} style={{ flexDirection: "row", gap: 10, alignItems: "stretch" }}>
      {row.map(({ role, person }) => {
        const submitting = role === "worker" ? sending.includes(person.id) : sendingContractors.includes(person.id);
        const requested = role === "worker" ? pending.has(person.id) : pendingContractors.has(person.id);
        return <View key={`${role}-${person.id}`} style={{ flex: 1, minWidth: 0 }}><RecommendedWorkerCard worker={person}
          inviteLabel={submitting ? "Sending…" : requested ? role === "worker" && pending.get(person.id) === "worker" ? "Application Pending" : "Invite Sent" : "Invite"}
          disabled={!managing.canInvite || submitting || requested}
          onInvite={() => { if (role === "worker") void invite(person.id); else void inviteContractor(person.id); }}
          onView={() => setProfile({ ...person, role })} />
        </View>;
      })}
      {row.length < layout.recommendationColumns && <View style={{ flex: 1 }} />}
    </View>)}
    </View>)}
    {profile && <TeamProfileDetails key={`${managing.projectId}-${profile.role}-${profile.id}`} member={profile} onClose={() => setProfile(null)} />}
    </>}
  </WorkersDirectory>;
}
const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 18, padding: 14, shadowColor: "#000", shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 1 },
});
