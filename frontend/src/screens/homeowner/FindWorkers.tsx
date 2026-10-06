import { useEffect, useState } from "react";
import { Text, View, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Badge, Card, Field, PageHeader, Screen, SubmitButton } from "@/components/ui";
import { searchWorkers, rateWorker } from "@/services/api/workers";
import { searchContractors, rateContractor } from "@/services/api/contractors";
import {
  assignWorkerToProject,
  unassignWorkerFromProject,
  assignContractorToProject,
  unassignContractorFromProject,
  fetchDashboard,
} from "@/services/api/projects";
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

function AssignButton({ assigned, assigning, onPress }: { assigned: boolean; assigning: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={assigning}
      className="flex-row items-center justify-center gap-1.5 py-2 rounded-xl mb-2"
      style={{ backgroundColor: assigned ? "#10b98120" : "#f59e0b", opacity: assigning ? 0.6 : 1 }}
    >
      <Ionicons name={assigned ? "checkmark-circle" : "add-circle-outline"} size={15} color={assigned ? "#10b981" : "#0f1117"} />
      <Text className="text-xs font-semibold" style={{ color: assigned ? "#10b981" : "#0f1117" }}>
        {assigning ? "Saving…" : assigned ? "Added to Project" : "Add to Project"}
      </Text>
    </Pressable>
  );
}

function WorkerCard({
  worker,
  projectId,
  assigned,
  onAssignedChange,
}: {
  worker: WorkerSearchResult;
  projectId: number | null;
  assigned: boolean;
  onAssignedChange: (id: number, assigned: boolean) => void;
}) {
  const [rating, setRating] = useState(false);
  const [done, setDone] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const toggleAssign = async () => {
    if (!projectId) return;
    setAssigning(true);
    try {
      if (assigned) {
        await unassignWorkerFromProject(projectId, worker.id);
        onAssignedChange(worker.id, false);
      } else {
        await assignWorkerToProject(projectId, worker.id);
        onAssignedChange(worker.id, true);
      }
    } catch {
      // Keep current state; the user can retry.
    } finally {
      setAssigning(false);
    }
  };

  return (
    <Card>
      <View className="flex-row items-start justify-between gap-2 mb-2">
        <View className="flex-1">
          <Text className="font-bold text-sm text-foreground">{worker.name}</Text>
          <Text className="text-xs text-muted-foreground">
            {worker.trade} · {worker.yearsExperience} yrs experience
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

      {worker.bio && <Text className="text-xs text-secondary-foreground mb-2">{worker.bio}</Text>}

      <View className="flex-row flex-wrap gap-1.5 mb-3">
        {worker.skills.map((skill) => (
          <Badge key={skill} label={skill} color="#9ca3af" />
        ))}
      </View>

      {projectId && <AssignButton assigned={assigned} assigning={assigning} onPress={toggleAssign} />}

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
}: {
  contractor: ContractorSearchResult;
  projectId: number | null;
  assigned: boolean;
  onAssignedChange: (id: number, assigned: boolean) => void;
}) {
  const [rating, setRating] = useState(false);
  const [done, setDone] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const toggleAssign = async () => {
    if (!projectId) return;
    setAssigning(true);
    try {
      if (assigned) {
        await unassignContractorFromProject(projectId, contractor.id);
        onAssignedChange(contractor.id, false);
      } else {
        await assignContractorToProject(projectId, contractor.id);
        onAssignedChange(contractor.id, true);
      }
    } catch {
      // Keep current state; the user can retry.
    } finally {
      setAssigning(false);
    }
  };

  return (
    <Card>
      <View className="flex-row items-start justify-between gap-2 mb-2">
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

      {contractor.bio && <Text className="text-xs text-secondary-foreground mb-2">{contractor.bio}</Text>}

      <View className="flex-row flex-wrap gap-1.5 mb-3">
        {contractor.skills.map((skill) => (
          <Badge key={skill} label={skill} color="#9ca3af" />
        ))}
      </View>

      {projectId && <AssignButton assigned={assigned} assigning={assigning} onPress={toggleAssign} />}

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
  const [mode, setMode] = useState<Mode>("workers");
  const [query, setQuery] = useState("");
  const [skillInput, setSkillInput] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [workerResults, setWorkerResults] = useState<WorkerSearchResult[] | null>(null);
  const [contractorResults, setContractorResults] = useState<ContractorSearchResult[] | null>(null);
  const [loading, setLoading] = useState(true); // starts true: we auto-load on mount below
  const [error, setError] = useState<string | null>(null);

  const [projectId, setProjectId] = useState<number | null>(null);
  const [projectTitle, setProjectTitle] = useState<string | null>(null);
  const [assignedWorkerIds, setAssignedWorkerIds] = useState<Set<number>>(new Set());
  const [assignedContractorIds, setAssignedContractorIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetchDashboard()
      .then(({ project }) => {
        if (!project) return;
        setProjectId(project.id);
        setProjectTitle(project.title);
        setAssignedWorkerIds(new Set(project.workers.map((w) => w.id)));
        setAssignedContractorIds(new Set(project.contractors.map((c) => c.id)));
      })
      .catch(() => undefined);
  }, []);

  const loadResults = (targetMode: Mode) => {
    setLoading(true);
    setError(null);
    const request = targetMode === "workers" ? searchWorkers({}) : searchContractors({});
    request
      .then((data) => {
        if (targetMode === "workers") setWorkerResults(data as WorkerSearchResult[]);
        else setContractorResults(data as ContractorSearchResult[]);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load."))
      .finally(() => setLoading(false));
  };

  // Browse all available workers by default as soon as the screen opens.
  useEffect(() => {
    searchWorkers({})
      .then(setWorkerResults)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load."))
      .finally(() => setLoading(false));
  }, []);

  const switchMode = (next: Mode) => {
    setMode(next);
    setQuery("");
    setSkills([]);
    setSkillInput("");
    setError(null);
    if (next === "workers" && workerResults === null) loadResults("workers");
    if (next === "contractors" && contractorResults === null) loadResults("contractors");
  };

  const handleWorkerAssignedChange = (id: number, assigned: boolean) => {
    setAssignedWorkerIds((prev) => {
      const next = new Set(prev);
      if (assigned) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleContractorAssignedChange = (id: number, assigned: boolean) => {
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

  const search = async () => {
    setLoading(true);
    setError(null);
    try {
      if (mode === "workers") {
        const data = await searchWorkers({ trade: query.trim() || undefined, skills });
        setWorkerResults(data);
      } else {
        const data = await searchContractors({ specialization: query.trim() || undefined, skills });
        setContractorResults(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to search.");
    } finally {
      setLoading(false);
    }
  };

  const results = mode === "workers" ? workerResults : contractorResults;

  return (
    <Screen>
      <PageHeader title="Find Your Team" subtitle="Browse workers and contractors who signed up on Project-Panday, ranked by rating and experience. Filter to narrow it down." />

      {projectId && (
        <View className="flex-row items-center gap-1.5 px-1">
          <Ionicons name="briefcase-outline" size={13} color="#9ca3af" />
          <Text className="text-xs text-muted-foreground">
            Adding team members to: <Text className="text-foreground font-semibold">{projectTitle}</Text>
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
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Field
                  label=""
                  value={skillInput}
                  onChangeText={setSkillInput}
                  placeholder={mode === "workers" ? "e.g. Concrete Work" : "e.g. Project Management"}
                  onSubmitEditing={addSkill}
                  returnKeyType="done"
                />
              </View>
              <Pressable onPress={addSkill} className="px-4 items-center justify-center rounded-xl bg-primary">
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

      {loading && (
        <View className="items-center py-6">
          <ActivityIndicator color="#f59e0b" />
        </View>
      )}

      {!loading && results !== null && results.length === 0 && (
        <Text className="text-sm text-center text-muted-foreground py-6">
          No approved {mode === "workers" ? "workers" : "contractors"} {query.trim() || skills.length ? "match that filter" : "have signed up yet"}.
        </Text>
      )}

      {!loading &&
        mode === "workers" &&
        workerResults?.map((worker) => (
          <WorkerCard
            key={worker.id}
            worker={worker}
            projectId={projectId}
            assigned={assignedWorkerIds.has(worker.id)}
            onAssignedChange={handleWorkerAssignedChange}
          />
        ))}

      {!loading &&
        mode === "contractors" &&
        contractorResults?.map((contractor) => (
          <ContractorCard
            key={contractor.id}
            contractor={contractor}
            projectId={projectId}
            assigned={assignedContractorIds.has(contractor.id)}
            onAssignedChange={handleContractorAssignedChange}
          />
        ))}
    </Screen>
  );
}
