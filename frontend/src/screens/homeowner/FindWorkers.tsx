import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Text, View, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Badge, Card, Field, PageHeader, Screen, SubmitButton } from "@/components/ui";
import { searchWorkers, rateWorker } from "@/services/api/workers";
import { fetchHomeownerTeam } from "@/services/api/homeownerTeam";
import { searchContractors, rateContractor } from "@/services/api/contractors";
import {
  assignWorkerToProject,
  unassignWorkerFromProject,
  assignContractorToProject,
  unassignContractorFromProject,
  fetchActiveDashboard,
  fetchHiringWages,
} from "@/services/api/projects";
import { usePlan } from "@/context/PlanContext";
import { useTheme } from "@/context/ThemeContext";
import { ProfileAvatar } from "@/components/ProfilePhoto";
import { peso } from "@/utils/currency";
import { wageLine } from "@/utils/wage";
import TeamProfileDetails from "@/components/homeowner/TeamProfileDetails";
import ProjectHiringPrompt, { useHiringProjectPrompt } from "@/components/homeowner/ProjectHiringPrompt";
import type { HiringWage, HiringWageData } from "@/types/project";
import type { WorkerSearchResult } from "@/types/worker";
import type { ContractorSearchResult } from "@/types/contractor";

type Mode = "workers" | "contractors";

function SkillTag({ skill, onRemove }: { skill: string; onRemove?: () => void }) {
  return (
    <Pressable
      onPress={onRemove}
      disabled={!onRemove}
      className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full"
      style={{ backgroundColor: "#f59e0b20" }}
    >
      <Text className="text-xs font-medium" style={{ color: "#f59e0b" }}>
        {skill}
      </Text>
      {onRemove && <Ionicons name="close" size={12} color="#f59e0b" />}
    </Pressable>
  );
}

function RatingForm({ onCancel, onSubmit }: { onCancel: () => void; onSubmit: (score: number, comment?: string) => Promise<void> }) {
  const [score, setScore] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    try {
      await onSubmit(score, comment.trim() || undefined);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ gap: 8 }}>
      <View className="flex-row gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} onPress={() => setScore(n)}>
            <Ionicons name={n <= score ? "star" : "star-outline"} size={22} color="#f59e0b" />
          </Pressable>
        ))}
      </View>
      <Field label="" value={comment} onChangeText={setComment} placeholder="Optional comment" />
      <View className="flex-row gap-2">
        <Pressable onPress={onCancel} className="flex-1 py-2 rounded-xl items-center bg-muted border border-border">
          <Text className="text-xs text-muted-foreground">Cancel</Text>
        </Pressable>
        <Pressable
          onPress={submit}
          disabled={submitting}
          className="flex-1 py-2 rounded-xl items-center bg-primary"
          style={{ opacity: submitting ? 0.6 : 1 }}
        >
          <Text className="text-xs font-semibold text-primary-foreground">{submitting ? "Submitting…" : "Submit Rating"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * Both workers and contractors now go through an invite (pending until they respond) rather
 * than being assigned outright — this button has three states: not invited, pending, or on
 * the project.
 */
function AssignButton({
  assigned,
  pending,
  assigning,
  onPress,
}: {
  assigned: boolean;
  pending: boolean;
  assigning: boolean;
  onPress: () => void;
}) {
  const { chrome } = useTheme();
  const color = assigned ? "#10b981" : pending ? chrome.mutedForeground : "#0f1117";
  const label = assigning ? "Sending…" : assigned ? "On Project" : pending ? "Request Pending" : "Invite to Project";
  return (
    <Pressable
      onPress={onPress}
      disabled={assigning || pending}
      className="flex-row items-center justify-center gap-1.5 py-2 rounded-xl mb-2"
      style={{ backgroundColor: assigned ? "#10b98120" : pending ? chrome.muted : "#f59e0b", opacity: assigning ? 0.6 : 1 }}
    >
      <Ionicons name={assigned ? "checkmark-circle" : pending ? "time-outline" : "person-add-outline"} size={15} color={color} />
      <Text className="text-xs font-semibold" style={{ color }}>
        {label}
      </Text>
    </Pressable>
  );
}

function HiringWageInfo({ preview, projectId, loading }: { preview?: HiringWage; projectId: number | null; loading: boolean }) {
  let label = "Project wage";
  let explanation = projectId ? "Wage information is unavailable. Refresh to try again." : "Select an approved project to see its wage or fee estimate.";
  if (preview) {
    switch (preview.source) {
      case "project":
        label = preview.wage?.auto ? "Automatic wage estimate" : "Wage on this project";
        explanation = !preview.wage ? "No wage has been set for this person on the selected project." : preview.wage.auto ? "Calculated for this project; confirm the amount before hiring." : "Saved for this person on the selected project.";
        break;
      case "worker_minimum":
        label = "Estimated project wage";
        explanation = "Based on the worker's asking daily rate and this project's working days.";
        break;
      case "app_default":
        label = "Estimated project wage";
        explanation = "Uses the app's default daily rate. This worker has not provided an asking rate.";
        break;
      case "application_quote":
        label = "Contractor's project quote";
        explanation = "Submitted by this contractor for your project; subject to acceptance.";
        break;
      case "project_estimate":
        label = "Estimated contractor fee";
        explanation = "Based on this project's fee estimate, split across the contractors after this person joins.";
        break;
    }
  }

  return (
    <View className="rounded-xl p-3 mb-3 bg-muted border border-border" style={{ gap: 4 }}>
      <View className="flex-row items-center gap-1.5">
        <Ionicons name="wallet-outline" size={14} color="#10b981" />
        <Text className="text-xs font-semibold text-foreground">{label}</Text>
      </View>
      <Text className="text-sm font-bold" style={{ color: "#10b981" }}>
        {loading ? "Loading wage…" : preview ? preview.wage ? wageLine(preview.wage) : "No wage set" : "Not available"}
      </Text>
      {!loading && <Text className="text-xs leading-4 text-muted-foreground">{explanation}</Text>}
    </View>
  );
}

function WorkerCard({
  worker,
  projectId,
  assigned,
  onAssignedChange,
  hiringWage,
  wageLoading,
  pending,
  onInvited,
  onView,
  onNeedsProject,
}: {
  worker: WorkerSearchResult;
  projectId: number | null;
  assigned: boolean;
  onAssignedChange: (id: number, assigned: boolean) => void;
  hiringWage?: HiringWage;
  wageLoading: boolean;
  pending: boolean;
  onInvited: () => void;
  onView: () => void;
  onNeedsProject: () => void;
}) {
  const [rating, setRating] = useState(false);
  const [done, setDone] = useState(false);
  const [assigning, setAssigning] = useState(false);
  // The parent also restores pending requests from this project's real hiring records.
  const [invited, setInvited] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const toggleAssign = async () => {
    if (!projectId) return;
    setAssigning(true);
    setInviteError(null);
    try {
      if (assigned) {
        await unassignWorkerFromProject(projectId, worker.id);
        onAssignedChange(worker.id, false);
      } else {
        await assignWorkerToProject(projectId, worker.id);
        setInvited(true);
        onInvited();
      }
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Failed to send invite.");
    } finally {
      setAssigning(false);
    }
  };

  return (
    <Card>
      <View className="flex-row items-start justify-between gap-2 mb-2">
        <ProfileAvatar name={worker.name} url={worker.photoUrl} size={40} />
        <View className="flex-1">
          <Text className="font-bold text-sm text-foreground">{worker.name}</Text>
          <Text className="text-xs text-muted-foreground">
            {worker.trade} · {worker.yearsExperience} yrs experience
          </Text>
          <Text className="text-xs mt-0.5 font-semibold" style={{ color: worker.minDailyWage != null ? "#10b981" : "#9ca3af" }}>
            {worker.minDailyWage != null ? `Asks from ${peso(worker.minDailyWage)}/day` : "Asking daily rate not provided"}
          </Text>
        </View>
        {worker.averageRating != null ? (
          <View className="flex-row items-center gap-1">
            <Ionicons name="star" size={13} color="#f59e0b" />
            <Text className="text-xs font-semibold" style={{ color: "#f59e0b" }}>
              {worker.averageRating} ({worker.ratingCount})
            </Text>
          </View>
        ) : (
          <Text className="text-xs text-muted-foreground">No ratings yet</Text>
        )}
      </View>

      {projectId && <HiringWageInfo preview={hiringWage} projectId={projectId} loading={wageLoading} />}
      {worker.bio && <Text className="text-xs text-secondary-foreground mb-2">{worker.bio}</Text>}

      <View className="flex-row flex-wrap gap-1.5 mb-3">
        {worker.skills.map((skill) => (
          <Badge key={skill} label={skill} color="#9ca3af" />
        ))}
      </View>

      <Pressable accessibilityRole="button" accessibilityLabel={`View ${worker.name}'s profile`} onPress={onView} className="self-start px-3 py-2 rounded-xl bg-muted border border-border mb-2"><Text className="text-xs font-semibold text-foreground">View Profile</Text></Pressable>
      <AssignButton assigned={assigned} pending={(invited || pending) && !assigned} assigning={assigning} onPress={projectId ? toggleAssign : onNeedsProject} />
      {inviteError && <Text className="text-xs text-danger mb-2">{inviteError}</Text>}

      {done ? (
        <Badge label="Rating submitted" color="#10b981" />
      ) : rating ? (
        <RatingForm
          onCancel={() => setRating(false)}
          onSubmit={async (score, comment) => {
            try {
              await rateWorker(worker.id, score, comment);
              setDone(true);
              setRating(false);
            } catch {
              // Leave the form open so the user can retry.
            }
          }}
        />
      ) : (
        <Pressable onPress={() => setRating(true)} className="self-start px-3 py-1.5 rounded-lg bg-muted border border-border">
          <Text className="text-xs font-medium text-muted-foreground">Rate this worker</Text>
        </Pressable>
      )}
    </Card>
  );
}

function ContractorCard({
  contractor,
  projectId,
  assigned,
  onAssignedChange,
  hiringWage,
  wageLoading,
  pending,
  onInvited,
  onView,
  onNeedsProject,
}: {
  contractor: ContractorSearchResult;
  projectId: number | null;
  assigned: boolean;
  onAssignedChange: (id: number, assigned: boolean) => void;
  hiringWage?: HiringWage;
  wageLoading: boolean;
  pending: boolean;
  onInvited: () => void;
  onView: () => void;
  onNeedsProject: () => void;
}) {
  const [rating, setRating] = useState(false);
  const [done, setDone] = useState(false);
  const [assigning, setAssigning] = useState(false);
  // Keep immediate feedback while the parent refreshes the persisted pending request.
  const [invited, setInvited] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const toggleAssign = async () => {
    if (!projectId) return;
    setAssigning(true);
    setInviteError(null);
    try {
      if (assigned) {
        await unassignContractorFromProject(projectId, contractor.id);
        onAssignedChange(contractor.id, false);
      } else {
        await assignContractorToProject(projectId, contractor.id);
        setInvited(true);
        onInvited();
      }
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Failed to send invite.");
    } finally {
      setAssigning(false);
    }
  };

  return (
    <Card>
      <View className="flex-row items-start justify-between gap-2 mb-2">
        <ProfileAvatar name={contractor.name} url={contractor.photoUrl} size={40} />
        <View className="flex-1">
          <Text className="font-bold text-sm text-foreground">{contractor.companyName || contractor.name}</Text>
          <Text className="text-xs text-muted-foreground">
            {contractor.specialization} · {contractor.yearsExperience} yrs experience
          </Text>
        </View>
        {contractor.averageRating != null ? (
          <View className="flex-row items-center gap-1">
            <Ionicons name="star" size={13} color="#f59e0b" />
            <Text className="text-xs font-semibold" style={{ color: "#f59e0b" }}>
              {contractor.averageRating} ({contractor.ratingCount})
            </Text>
          </View>
        ) : (
          <Text className="text-xs text-muted-foreground">No ratings yet</Text>
        )}
      </View>

      {projectId && <HiringWageInfo preview={hiringWage} projectId={projectId} loading={wageLoading} />}
      {contractor.bio && <Text className="text-xs text-secondary-foreground mb-2">{contractor.bio}</Text>}

      <View className="flex-row flex-wrap gap-1.5 mb-3">
        {contractor.skills.map((skill) => (
          <Badge key={skill} label={skill} color="#9ca3af" />
        ))}
      </View>

      <Pressable accessibilityRole="button" accessibilityLabel={`View ${contractor.name}'s profile`} onPress={onView} className="self-start px-3 py-2 rounded-xl bg-muted border border-border mb-2"><Text className="text-xs font-semibold text-foreground">View Profile</Text></Pressable>
      <AssignButton assigned={assigned} pending={(invited || pending) && !assigned} assigning={assigning} onPress={projectId ? toggleAssign : onNeedsProject} />
      {inviteError && <Text className="text-xs text-danger mb-2">{inviteError}</Text>}

      {done ? (
        <Badge label="Rating submitted" color="#10b981" />
      ) : rating ? (
        <RatingForm
          onCancel={() => setRating(false)}
          onSubmit={async (score, comment) => {
            try {
              await rateContractor(contractor.id, score, comment);
              setDone(true);
              setRating(false);
            } catch {
              // Leave the form open so the user can retry.
            }
          }}
        />
      ) : (
        <Pressable onPress={() => setRating(true)} className="self-start px-3 py-1.5 rounded-lg bg-muted border border-border">
          <Text className="text-xs font-medium text-muted-foreground">Rate this contractor</Text>
        </Pressable>
      )}
    </Card>
  );
}

export default function FindWorkers() {
  const { activeProjectKey, ready, refreshProjectSelection } = usePlan();
  const projectFlow = useHiringProjectPrompt();
  const [profile, setProfile] = useState<{ id: number; name: string; role: "worker" | "contractor" } | null>(null);
  const [mode, setMode] = useState<Mode>("workers");
  const [query, setQuery] = useState("");
  const [skillInput, setSkillInput] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [workerResults, setWorkerResults] = useState<WorkerSearchResult[] | null>(null);
  const [contractorResults, setContractorResults] = useState<ContractorSearchResult[] | null>(null);
  const [loading, setLoading] = useState(true); // starts true: we auto-load on mount below
  const [error, setError] = useState<string | null>(null);
  const searchVersion = useRef(0);
  const invalidateSearch = useCallback(() => { searchVersion.current++; }, []);

  const [projectId, setProjectId] = useState<number | null>(null);
  const [projectTitle, setProjectTitle] = useState<string | null>(null);
  const [assignedWorkerIds, setAssignedWorkerIds] = useState<Set<number>>(new Set());
  const [assignedContractorIds, setAssignedContractorIds] = useState<Set<number>>(new Set());
  const [pendingWorkerIds, setPendingWorkerIds] = useState<Set<number>>(new Set());
  const [pendingContractorIds, setPendingContractorIds] = useState<Set<number>>(new Set());
  const [hiringWages, setHiringWages] = useState<HiringWageData | null>(null);
  const [wageLoading, setWageLoading] = useState(true);
  const [wageError, setWageError] = useState<string | null>(null);
  const [wageVersion, setWageVersion] = useState(0);

  // The title of a "not started yet" project the team can't join until its plan is approved.
  const [pendingTitle, setPendingTitle] = useState<string | null>(null);

  // Re-checked every time the screen is opened, not once on mount: drawer screens stay mounted, so a
  // project that was deleted, replaced or just approved since would otherwise leave this pointing at
  // a stale id — and every invite to it fails with a "no query results" 404.
  useFocusEffect(
    useCallback(() => {
      if (!ready) return;
      let cancelled = false;
      setHiringWages(null);
      setWageLoading(true);
      setWageError(null);
      setProjectId(null);
      setProjectTitle(null);
      setPendingTitle(null);
      setAssignedWorkerIds(new Set());
      setAssignedContractorIds(new Set());
      setPendingWorkerIds(new Set());
      setPendingContractorIds(new Set());
      // The project the homeowner is looking at (the dashboard selects it for the AI chat too).
      const selected = /^\d+$/.test(activeProjectKey) ? Number(activeProjectKey) : undefined;
      (selected ? fetchActiveDashboard(selected) : Promise.resolve({ project: null }))
        .then(({ project }) => { if (selected && !project && !cancelled) void refreshProjectSelection(); return project; })
        .then((project) => {
          if (cancelled) return;
          // A team can only join a started project — a "not started yet" one has no plan to work from.
          const started = project && (project.status === "active" || project.status === "pending_confirmation") ? project : null;
          setProjectId(started?.id ?? null);
          setProjectTitle(started?.title ?? null);
          setPendingTitle(project && !started ? project.title : null);
          setAssignedWorkerIds(new Set(started?.workers.map((w) => w.id) ?? []));
          setAssignedContractorIds(new Set(started?.contractors.map((c) => c.id) ?? []));
          if (started) {
            return Promise.all([fetchHiringWages(started.id), fetchHomeownerTeam(started.id)]).then(([wages, team]) => {
              if (!cancelled) {
                setHiringWages(wages);
                setPendingWorkerIds(new Set(team.pendingWorkers.map(request => request.workerId)));
                setPendingContractorIds(new Set(team.pendingContractorIds));
              }
            });
          }
        })
        .catch((err) => {
          if (!cancelled) setWageError(err instanceof Error ? err.message : "Could not load team wages.");
        })
        .finally(() => { if (!cancelled) setWageLoading(false); });
      return () => {
        cancelled = true;
      };
    // The version intentionally refreshes records after removing a member or retrying.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeProjectKey, ready, refreshProjectSelection, wageVersion])
  );

  const runSearch = useCallback(async (targetMode: Mode, query: string | undefined, skills: string[]) => {
    const version = ++searchVersion.current;
    setLoading(true); setError(null);
    try {
      if (targetMode === "workers") {
        const data = await searchWorkers({ trade: query, skills });
        if (version === searchVersion.current) setWorkerResults(data);
      } else {
        const data = await searchContractors({ specialization: query, skills });
        if (version === searchVersion.current) setContractorResults(data);
      }
    } catch (err) {
      if (version === searchVersion.current) setError(err instanceof Error ? err.message : "Failed to load the directory. Please retry.");
    } finally { if (version === searchVersion.current) setLoading(false); }
  }, []);

  // Public browsing does not wait for project validation or use AI results. Hiring
  // and wages above still require the exact verified active project.
  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => { if (!cancelled) void runSearch("workers", undefined, []); });
    return () => { cancelled = true; invalidateSearch(); };
  }, [runSearch, invalidateSearch]);

  const switchMode = (next: Mode) => {
    setMode(next);
    setQuery("");
    setSkills([]);
    setSkillInput("");
    setError(null);
    searchVersion.current++;
    setLoading(false);
    if ((next === "workers" && workerResults === null) || (next === "contractors" && contractorResults === null)) void runSearch(next, undefined, []);
  };

  const handleWorkerAssignedChange = (id: number, assigned: boolean) => {
    setWageVersion((version) => version + 1);
    setAssignedWorkerIds((prev) => {
      const next = new Set(prev);
      if (assigned) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleContractorAssignedChange = (id: number, assigned: boolean) => {
    setWageVersion((version) => version + 1);
    setAssignedContractorIds((prev) => {
      const next = new Set(prev);
      if (assigned) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const addSkill = () => {
    const trimmed = skillInput.trim();
    if (!trimmed || skills.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      setSkillInput("");
      return;
    }
    setSkills((prev) => [...prev, trimmed]);
    setSkillInput("");
  };

  const search = () => runSearch(mode, query.trim() || undefined, skills);

  const results = mode === "workers" ? workerResults : contractorResults;
  const workerWagesById = new Map(hiringWages?.workers.map((entry) => [entry.userId, entry]));
  const contractorWagesById = new Map(hiringWages?.contractors.map((entry) => [entry.userId, entry]));

  return (
    <Screen topInset={false}>
      <PageHeader
        title="Find Your Team"
        subtitle="Browse approved workers and contractors. Use the filters to narrow it down."
      />
      <Text className="text-xs leading-5 text-muted-foreground">Wages are filled in automatically when team members join your project. Estimates are marked below; you do not need to enter amounts manually.</Text>

      {!projectId && <ProjectHiringPrompt flow={projectFlow} />}

      {projectId && (
        <View className="flex-row items-center gap-1.5 px-1">
          <Ionicons name="briefcase-outline" size={13} color="#9ca3af" />
          <Text className="text-xs text-muted-foreground">
            Adding team members to: <Text className="text-foreground font-semibold">{projectTitle}</Text>
          </Text>
        </View>
      )}
      {!projectId && pendingTitle && (
        <View className="flex-row items-start gap-1.5 px-1">
          <Ionicons name="hourglass-outline" size={13} color="#f59e0b" style={{ marginTop: 1 }} />
          <Text className="text-xs flex-1" style={{ color: "#f59e0b" }}>
            &quot;{pendingTitle}&quot; hasn&apos;t started yet. Finish its plan with PandAi, then you can invite a team.
          </Text>
        </View>
      )}

      <View className="flex-row rounded-xl overflow-hidden border border-border">
        {(["workers", "contractors"] as Mode[]).map((m) => (
          <Pressable
            key={m}
            onPress={() => switchMode(m)}
            className="flex-1 py-2.5 items-center"
            style={{ backgroundColor: mode === m ? "#f59e0b20" : "transparent" }}
          >
            <Text className="text-xs font-semibold capitalize" style={{ color: mode === m ? "#f59e0b" : "#9ca3af" }}>
              {m === "workers" ? "Skilled Workers" : "Contractors"}
            </Text>
          </Pressable>
        ))}
      </View>

      <Card title="Filter">
        <View style={{ gap: 12 }}>
          <Field
            label={mode === "workers" ? "Trade" : "Specialization"}
            value={query}
            onChangeText={setQuery}
            placeholder={mode === "workers" ? "e.g. Mason, Electrician" : "e.g. Residential Renovation"}
          />
          <View>
            <Text className="text-xs font-medium mb-2 text-secondary-foreground">
              {mode === "workers" ? "Skills needed" : "Services needed"}
            </Text>
            <View className="flex-row flex-wrap gap-2 mb-2">
              {skills.map((skill) => (
                <SkillTag key={skill} skill={skill} onRemove={() => setSkills((prev) => prev.filter((s) => s !== skill))} />
              ))}
            </View>
            <View className="flex-row gap-2" style={{ alignItems: "center" }}>
              <View className="flex-1">
                <Field
                  label=""
                  value={skillInput}
                  onChangeText={setSkillInput}
                  placeholder={mode === "workers" ? "e.g. Concrete Work" : "e.g. Project Management"}
                  onSubmitEditing={addSkill}
                  returnKeyType="done"
                  style={{ minHeight: 44 }}
                />
              </View>
              <Pressable onPress={addSkill} accessibilityRole="button" accessibilityLabel={mode === "workers" ? "Add skill" : "Add service"}
                className="items-center justify-center rounded-xl bg-primary"
                style={{ width: 44, height: 44, flexShrink: 0, alignSelf: "center" }}>
                <Ionicons name="add" size={18} color="#0f1117" />
              </Pressable>
            </View>
          </View>
          <SubmitButton
            label={loading ? "Filtering…" : `Filter ${mode === "workers" ? "Workers" : "Contractors"}`}
            onPress={search}
          />
        </View>
      </Card>

      {error && <Text className="text-xs text-danger px-1">{error}</Text>}
      {wageError && (
        <View style={{ gap: 6 }}>
          <Text className="text-xs text-danger">Could not refresh team wages: {wageError}</Text>
          <Pressable accessibilityRole="button" onPress={() => setWageVersion((version) => version + 1)} className="self-start px-3 py-2 rounded-lg bg-muted border border-border">
            <Text className="text-xs font-semibold text-foreground">Retry wages</Text>
          </Pressable>
        </View>
      )}

      {loading && (
        <View className="items-center py-6">
          <ActivityIndicator color="#f59e0b" />
        </View>
      )}

      {!loading && !error && results !== null && results.length === 0 && (
        <Text className="text-sm text-center text-muted-foreground py-6">
          No approved {mode === "workers" ? "workers" : "contractors"} {query.trim() || skills.length ? "match that filter" : "have signed up yet"}.
        </Text>
      )}

      {!loading &&
        mode === "workers" &&
        workerResults?.map((worker) => (
          <WorkerCard
            key={`${projectId}-${worker.id}`}
            worker={worker}
            projectId={projectId}
            assigned={assignedWorkerIds.has(worker.id)}
            onAssignedChange={handleWorkerAssignedChange}
            hiringWage={workerWagesById.get(worker.id)}
            wageLoading={wageLoading}
            pending={pendingWorkerIds.has(worker.id)}
            onInvited={() => { setPendingWorkerIds(previous => new Set([...previous, worker.id])); setWageVersion(version => version + 1); }}
            onView={() => setProfile({ id: worker.id, name: worker.name, role: "worker" })}
            onNeedsProject={projectFlow.requireProject}
          />
        ))}

      {!loading &&
        mode === "contractors" &&
        contractorResults?.map((contractor) => (
          <ContractorCard
            key={`${projectId}-${contractor.id}`}
            contractor={contractor}
            projectId={projectId}
            assigned={assignedContractorIds.has(contractor.id)}
            onAssignedChange={handleContractorAssignedChange}
            hiringWage={contractorWagesById.get(contractor.id)}
            wageLoading={wageLoading}
            pending={pendingContractorIds.has(contractor.id)}
            onInvited={() => { setPendingContractorIds(previous => new Set([...previous, contractor.id])); setWageVersion(version => version + 1); }}
            onView={() => setProfile({ id: contractor.id, name: contractor.name, role: "contractor" })}
            onNeedsProject={projectFlow.requireProject}
          />
        ))}
      {profile && <TeamProfileDetails key={`${profile.role}-${profile.id}`} member={profile} onClose={() => setProfile(null)} />}
    </Screen>
  );
}
