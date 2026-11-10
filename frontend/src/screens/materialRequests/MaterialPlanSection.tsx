import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { CountUp } from "@/components/charts";
import { Badge, Button, Card, Field, InfoBox, MONO, ProgressBar, SubmitButton } from "@/components/ui";
import Sheet from "@/components/Sheet";
import { RequestStatusBadge } from "@/components/MaterialStatusBadge";
import { useTheme } from "@/context/ThemeContext";
import {
  fetchMaterialPlan,
  requestPhaseMaterials,
  reviewMaterialPlan,
  setAutoApproveMaterials,
} from "@/services/api/materialRequests";
import { fetchMyHomeownerProjects, fetchMyProjects } from "@/services/api/projects";
import type { MaterialPlan, MaterialPlanLine, MaterialPlanPhase, MaterialReviewLine } from "@/types/materialRequest";
import { peso } from "@/utils/currency";
import { formatShortDate } from "@/utils/timeline";

type Viewer = "contractor" | "homeowner";

const WASTE_OPTIONS = [0, 5, 10, 15];
const errorMessage = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);

/**
 * A project's materials planned phase by phase: what each phase needs, the date to order it by (from the
 * calendar), and — for the contractor — the one-time review of the AI's quantities and one-tap drafting
 * of each phase's request. The homeowner sees how the review compares with the AI, the budget room per
 * category, and controls whether requests that stay inside their plan approve themselves.
 */
export default function MaterialPlanSection({ viewer, detailPath }: { viewer: Viewer; detailPath: (id: number) => string }) {
  const { chrome } = useTheme();
  const [projects, setProjects] = useState<{ id: number; title: string }[] | null>(null);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [plan, setPlan] = useState<MaterialPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [busy, setBusy] = useState<number | "settings" | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const request = viewer === "contractor" ? fetchMyProjects() : fetchMyHomeownerProjects();
      request
        .then((list) => {
          if (cancelled) return;
          // A "not started yet" project has no plan; a contractor works on active ones.
          const options = list.filter((p) => p.status === "active").map((p) => ({ id: p.id, title: p.title }));
          setProjects(options);
          setProjectId((current) => (current && options.some((o) => o.id === current) ? current : (options[0]?.id ?? null)));
        })
        .catch((err) => !cancelled && setError(errorMessage(err, "Failed to load projects.")));
      return () => {
        cancelled = true;
      };
    }, [viewer])
  );

  const loadPlan = useCallback(() => {
    if (projectId === null) return () => undefined;
    let cancelled = false;
    fetchMaterialPlan(projectId)
      .then((data) => {
        if (cancelled) return;
        setPlan(data);
        setError(null);
      })
      .catch((err) => !cancelled && setError(errorMessage(err, "Failed to load the material plan.")));
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useFocusEffect(loadPlan);

  const pickProject = (id: number) => {
    if (id === projectId) return;
    setPlan(null);
    setExpanded(null);
    setProjectId(id);
  };

  // Nothing to plan until a project is started; say nothing rather than add an empty card.
  if (projects !== null && projects.length === 0) return null;

  const draftPhase = async (phase: MaterialPlanPhase) => {
    if (busy !== null || projectId === null) return;
    setBusy(phase.phaseId);
    setError(null);
    try {
      const request = await requestPhaseMaterials(projectId, phase.phaseId);
      router.push(detailPath(request.id) as never);
    } catch (err) {
      setError(errorMessage(err, "Couldn't draft the request."));
    } finally {
      setBusy(null);
    }
  };

  const toggleAuto = async (enabled: boolean) => {
    if (busy !== null || projectId === null || !plan) return;
    setBusy("settings");
    setPlan({ ...plan, autoApprove: enabled });
    try {
      await setAutoApproveMaterials(projectId, enabled);
    } catch (err) {
      setPlan({ ...plan, autoApprove: !enabled });
      setError(errorMessage(err, "Couldn't save the setting."));
    } finally {
      setBusy(null);
    }
  };

  const saveReview = async (lines: MaterialReviewLine[]) => {
    if (projectId === null) return;
    setPlan(await reviewMaterialPlan(projectId, lines));
  };

  return (
    <Card title="Materials by phase" gap={12}>
      {projects !== null && projects.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {projects.map((p) => {
            const active = p.id === projectId;
            return (
              <Pressable
                key={p.id}
                onPress={() => pickProject(p.id)}
                className="px-3 py-2 rounded-xl border"
                style={{ backgroundColor: active ? "#f59e0b20" : chrome.muted, borderColor: active ? "#f59e0b" : chrome.border }}
              >
                <Text className="text-xs font-semibold" style={{ color: active ? "#f59e0b" : chrome.mutedForeground }} numberOfLines={1}>
                  {p.title}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {error && <Text className="text-xs text-danger">{error}</Text>}

      {!plan && !error && <ActivityIndicator color="#f59e0b" style={{ marginVertical: 12 }} />}

      {plan && !plan.hasPlan && (
        <Text className="text-xs text-muted-foreground">
          This project has no AI material plan. Only projects made from the AI planner have one — you can still create a request by hand.
        </Text>
      )}

      {plan && plan.hasPlan && (
        <>
          <ReviewStatus plan={plan} viewer={viewer} onReview={() => setReviewing(true)} />

          {plan.categoryBudgets.length > 0 && <CategoryBudgets budgets={plan.categoryBudgets} />}

          {plan.phases.map((phase) => (
            <PhaseRow
              key={phase.phaseId}
              phase={phase}
              viewer={viewer}
              reviewed={plan.reviewed}
              open={expanded === phase.phaseId}
              busy={busy === phase.phaseId}
              onToggle={() => setExpanded(expanded === phase.phaseId ? null : phase.phaseId)}
              onDraft={() => draftPhase(phase)}
              onOpenRequest={(id) => router.push(detailPath(id) as never)}
            />
          ))}

          {plan.unscheduled && (
            <Text className="text-xs text-muted-foreground">
              {plan.unscheduled.lineCount} item{plan.unscheduled.lineCount === 1 ? "" : "s"} ({peso(plan.unscheduled.estimatedTotal)}) in the plan
              {plan.unscheduled.lineCount === 1 ? " isn't" : " aren't"} tied to a phase — order {plan.unscheduled.lineCount === 1 ? "it" : "them"} with a
              request made by hand.
            </Text>
          )}

          {viewer === "homeowner" && (
            <View className="flex-row items-center gap-3 p-3 rounded-xl bg-muted">
              <View className="flex-1">
                <Text className="text-xs font-semibold text-foreground">Auto-approve requests inside my plan</Text>
                <Text className="text-xs text-muted-foreground">
                  Requests within your budget, quantities and chosen suppliers approve themselves. You&apos;re only asked about exceptions.
                </Text>
              </View>
              <Switch
                value={plan.autoApprove}
                onValueChange={toggleAuto}
                disabled={busy === "settings"}
                trackColor={{ true: "#f59e0b", false: chrome.border }}
                accessibilityLabel="Auto-approve requests inside my plan"
              />
            </View>
          )}
        </>
      )}

      {reviewing && plan && <QuantityReviewSheet plan={plan} onClose={() => setReviewing(false)} onSave={saveReview} />}
    </Card>
  );
}

function ReviewStatus({ plan, viewer, onReview }: { plan: MaterialPlan; viewer: Viewer; onReview: () => void }) {
  if (!plan.reviewed) {
    return viewer === "contractor" ? (
      <InfoBox color="#f59e0b" title="Review the AI's quantities first">
        <Text className="text-xs leading-5 text-secondary-foreground">
          The AI estimates quantities roughly. Check them once and add a waste allowance — every phase request is then built from your
          numbers.
        </Text>
        <View className="flex-row mt-3">
          <Button label="Review quantities" onPress={onReview} />
        </View>
      </InfoBox>
    ) : (
      <Text className="text-xs text-muted-foreground">
        These are the AI&apos;s original quantities — not yet reviewed by a contractor.
      </Text>
    );
  }

  const variance = plan.variancePct === 0 ? "same cost as the AI estimate" : `${plan.variancePct > 0 ? "+" : ""}${plan.variancePct}% vs the AI estimate`;
  return (
    <View className="flex-row items-center justify-between gap-3 p-3 rounded-xl bg-muted">
      <View className="flex-1">
        <Text className="text-xs font-semibold" style={{ color: "#10b981" }}>
          Quantities reviewed{plan.reviewedBy ? ` by ${plan.reviewedBy}` : ""}
        </Text>
        <Text className="text-xs text-muted-foreground">
          {peso(plan.plannedTotal)} planned · {variance}
        </Text>
      </View>
      {viewer === "contractor" && <Button label="Re-review" variant="muted" onPress={onReview} />}
    </View>
  );
}

function CategoryBudgets({ budgets }: { budgets: MaterialPlan["categoryBudgets"] }) {
  return (
    <View style={{ gap: 8 }}>
      <Text className="text-xs font-bold text-foreground">Budget room</Text>
      {budgets.map((b) => {
        const pct = b.budget > 0 ? Math.min(100, Math.round((b.committed / b.budget) * 100)) : 0;
        const over = b.remaining < 0;
        return (
          <View key={b.category}>
            <View className="flex-row justify-between mb-1">
              <Text className="text-xs text-muted-foreground">{b.category}</Text>
              <Text className="text-xs font-semibold" style={{ color: over ? "#ef4444" : "#9ca3af", fontFamily: MONO }}>
                {peso(b.committed)} / {peso(b.budget)}
              </Text>
            </View>
            <ProgressBar pct={pct} color={over ? "#ef4444" : pct > 80 ? "#f59e0b" : "#10b981"} height={6} />
          </View>
        );
      })}
    </View>
  );
}

/** When to request materials, in words: the date, how soon it is, and whether it has been handled. */
function orderBy(phase: MaterialPlanPhase): { label: string; color: string } {
  const ordered = phase.requests.some((r) => r.status === "approved" || r.status === "completed");
  if (ordered) return { label: "Requested", color: "#10b981" };
  const date = formatShortDate(phase.neededBy);
  if (phase.daysUntilNeeded < 0) return { label: `Request date passed (${date})`, color: "#ef4444" };
  if (phase.daysUntilNeeded <= 7) return { label: `Request this week (by ${date})`, color: "#f59e0b" };
  return { label: `Request by ${date}`, color: "#9ca3af" };
}

function PhaseRow({
  phase,
  viewer,
  reviewed,
  open,
  busy,
  onToggle,
  onDraft,
  onOpenRequest,
}: {
  phase: MaterialPlanPhase;
  viewer: Viewer;
  reviewed: boolean;
  open: boolean;
  busy: boolean;
  onToggle: () => void;
  onDraft: () => void;
  onOpenRequest: (id: number) => void;
}) {
  const when = orderBy(phase);
  // The request a contractor continues from (their draft) or the homeowner reads; otherwise they can start one.
  const requests = phase.requests;
  const canDraft = viewer === "contractor" && requests.length === 0;

  return (
    <View className="p-3 rounded-2xl bg-muted" style={{ gap: 8 }}>
      <Pressable onPress={onToggle} className="flex-row items-start justify-between gap-3" accessibilityRole="button">
        <View className="flex-1" style={{ gap: 2 }}>
          <Text className="text-sm font-bold text-foreground">{phase.name}</Text>
          <Text className="text-xs font-semibold" style={{ color: when.color }}>
            {when.label}
          </Text>
          <Text className="text-xs text-muted-foreground">
            {phase.lineCount} item{phase.lineCount === 1 ? "" : "s"} · starts {formatShortDate(phase.startDate)}
          </Text>
        </View>
        <View className="items-end">
          <CountUp text={peso(phase.estimatedTotal)} className="text-sm font-bold text-primary" style={{ fontFamily: MONO }} />
          <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color="#f59e0b" />
        </View>
      </Pressable>

      {open && (
        <View style={{ gap: 6 }}>
          {phase.lines.map((line) => (
            <LineRow key={line.index} line={line} />
          ))}
        </View>
      )}

      {requests.map((r) => (
        <Pressable key={r.id} onPress={() => onOpenRequest(r.id)} className="flex-row items-center justify-between gap-2" accessibilityRole="button">
          <View className="flex-row items-center gap-2">
            <RequestStatusBadge status={r.status} />
            {r.autoApproved && <Badge label="Auto-approved" color="#3b82f6" />}
          </View>
          <Text className="text-xs font-semibold text-primary">Request #{r.id} →</Text>
        </Pressable>
      ))}

      {canDraft && (
        <View style={{ gap: 4 }}>
          <View className="flex-row">
            <Button label={busy ? "Drafting…" : "Draft request for this phase"} onPress={reviewed ? onDraft : undefined} variant={reviewed ? "primary" : "muted"} />
          </View>
          {!reviewed && <Text className="text-xs text-muted-foreground">Review the quantities above first.</Text>}
        </View>
      )}
    </View>
  );
}

function LineRow({ line }: { line: MaterialPlanLine }) {
  // Show what changed: the AI said one thing, the reviewed plan says another.
  const changed = line.reviewed && line.quantity !== line.aiQuantity;
  return (
    <View className="flex-row items-center justify-between gap-2">
      <View className="flex-1">
        <Text className="text-xs font-medium text-foreground" numberOfLines={1}>
          {line.material}
        </Text>
        <Text className="text-xs text-muted-foreground">
          {changed ? `AI ${line.aiQuantity.toLocaleString()} → ` : ""}
          {line.quantity.toLocaleString()} {line.unit}
          {line.wastePct > 0 ? ` (incl. ${line.wastePct}% waste)` : ""} · {line.match?.supplierName ?? "no matching listing"}
        </Text>
      </View>
      <Text className="text-xs font-semibold text-foreground" style={{ fontFamily: MONO }}>
        {peso(line.lineTotal)}
      </Text>
    </View>
  );
}

/** The contractor's one-time check: what each line really needs, plus a waste allowance on top. */
function QuantityReviewSheet({
  plan,
  onClose,
  onSave,
}: {
  plan: MaterialPlan;
  onClose: () => void;
  onSave: (lines: MaterialReviewLine[]) => Promise<void>;
}) {
  const { chrome } = useTheme();
  const lines = [...plan.phases.flatMap((p) => p.lines), ...(plan.unscheduled?.lines ?? [])].sort((a, b) => a.index - b.index);
  const [draft, setDraft] = useState<Record<number, { quantity: string; waste: number }>>(() =>
    Object.fromEntries(lines.map((l) => [l.index, { quantity: String(l.contractorQuantity), waste: l.wastePct }]))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const quantityOf = (l: MaterialPlanLine) => Number(draft[l.index]?.quantity) || 0;
  const orderQty = (l: MaterialPlanLine) => Math.ceil(quantityOf(l) * (1 + (draft[l.index]?.waste ?? 0) / 100));

  const save = async () => {
    if (saving) return;
    const bad = lines.find((l) => !/^\d+$/.test(draft[l.index]?.quantity ?? "") || quantityOf(l) < 1);
    if (bad) return setError(`Enter a quantity of at least 1 for ${bad.material}.`);
    setSaving(true);
    setError(null);
    try {
      await onSave(lines.map((l) => ({ index: l.index, quantity: quantityOf(l), waste_pct: draft[l.index].waste })));
      onClose();
    } catch (err) {
      setError(errorMessage(err, "Couldn't save the review."));
      setSaving(false);
    }
  };

  return (
    <Sheet visible title="Review quantities" subtitle="Change what you really need and add a waste allowance. The homeowner sees how it compares with the AI." onClose={onClose}>
      {lines.map((l) => (
        <View key={l.index} className="p-3 rounded-xl bg-muted" style={{ gap: 8 }}>
          <View className="flex-row justify-between gap-2">
            <Text className="flex-1 text-sm font-semibold text-foreground">{l.material}</Text>
            <Text className="text-xs text-muted-foreground">
              AI: {l.aiQuantity.toLocaleString()} {l.unit}
            </Text>
          </View>
          <View className="flex-row items-end gap-3">
            <View style={{ width: 110 }}>
              <Field
                label={`I need (${l.unit})`}
                keyboardType="number-pad"
                value={draft[l.index].quantity}
                onChangeText={(v) => setDraft((d) => ({ ...d, [l.index]: { ...d[l.index], quantity: v } }))}
              />
            </View>
            <View className="flex-1">
              <Text className="text-xs font-medium mb-2 text-secondary-foreground">Waste</Text>
              <View className="flex-row gap-1.5">
                {WASTE_OPTIONS.map((w) => {
                  const active = draft[l.index].waste === w;
                  return (
                    <Pressable
                      key={w}
                      onPress={() => setDraft((d) => ({ ...d, [l.index]: { ...d[l.index], waste: w } }))}
                      className="flex-1 py-2.5 rounded-lg items-center border"
                      style={{ backgroundColor: active ? "#f59e0b20" : chrome.card, borderColor: active ? "#f59e0b" : chrome.border }}
                    >
                      <Text className="text-xs font-semibold" style={{ color: active ? "#f59e0b" : chrome.mutedForeground }}>
                        {w}%
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
          <Text className="text-xs" style={{ color: "#10b981" }}>
            Will order {orderQty(l).toLocaleString()} {l.unit}
          </Text>
        </View>
      ))}
      {error && <Text className="text-xs text-danger">{error}</Text>}
      <SubmitButton label={saving ? "Saving…" : "Save review"} onPress={save} />
    </Sheet>
  );
}
