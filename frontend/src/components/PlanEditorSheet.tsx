import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Sheet from "@/components/Sheet";
import { Button, Field, InfoBox, SubmitButton } from "@/components/ui";
import { useTheme } from "@/context/ThemeContext";
import { budgetCategoryMeta } from "@/utils/budgetCategories";
import { peso } from "@/utils/currency";
import type { ConstructionPlan } from "@/types/plan";

export type PlanEditorTab = "details" | "phases" | "budget" | "materials";

const TABS: { key: PlanEditorTab; label: string }[] = [
  { key: "details", label: "Details" },
  { key: "phases", label: "Phases" },
  { key: "budget", label: "Budget" },
  { key: "materials", label: "Materials" },
];

// Everything is edited as text and parsed once on save — a half-typed "12." or an empty field
// would otherwise get coerced to a number on every keystroke and fight the cursor.
interface Draft {
  projectTitle: string;
  location: string;
  areaSqm: string;
  floors: string;
  bedrooms: string;
  bathrooms: string;
  garageCars: string;
  designStyle: string;
  budget: string;
  timelineMonths: string;
  exteriorConcept: string;
  interiorConcept: string;
  /** origName is the phase's name when the editor opened, so a rename can be carried to the materials that name it. */
  phases: { name: string; share: string; weeks: string; tasks: string; origName?: string }[];
  breakdown: { category: string; amount: string }[];
  materials: {
    material: string;
    category: string;
    qty: string;
    unit: string;
    unitPrice: string;
    /** The phase the material is first needed in — kept as is (and followed through a phase rename). */
    phase?: string;
    /** Set while the line is still exactly what the supplier lists; see toPlan(). */
    link?: SupplierLink;
  }[];
}

/** A material's supplier listing, plus the name/unit/price it had — so toPlan() can tell whether the
 * homeowner has since changed them by hand. */
interface SupplierLink {
  supplierProductId: number;
  supplierId?: number;
  supplierName?: string;
  material: string;
  unit: string;
  unitPrice: string;
}

const str = (n: number) => (Number.isFinite(n) ? String(n) : "");
const num = (s: string) => {
  const n = parseFloat(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};

function toDraft(plan: ConstructionPlan): Draft {
  return {
    projectTitle: plan.projectTitle,
    location: plan.location,
    areaSqm: str(plan.areaSqm),
    floors: str(plan.floors),
    bedrooms: str(plan.bedrooms),
    bathrooms: str(plan.bathrooms),
    garageCars: str(plan.garageCars ?? 0),
    designStyle: plan.designStyle,
    budget: plan.budget > 0 ? str(plan.budget) : "",
    timelineMonths: str(plan.timelineMonths),
    exteriorConcept: plan.exteriorConcept,
    interiorConcept: plan.interiorConcept,
    phases: plan.phases.map((p) => ({
      name: p.name,
      share: str(p.percentComplete),
      weeks: p.durationWeeks ? str(p.durationWeeks) : "",
      tasks: p.tasks.join("\n"),
      origName: p.name,
    })),
    breakdown: plan.budgetBreakdown.map((b) => ({ category: b.category, amount: str(b.amount) })),
    materials: plan.materials.map((m) => ({
      material: m.material,
      category: m.category,
      qty: str(m.qty),
      unit: m.unit,
      unitPrice: str(m.unitPrice),
      phase: m.phase,
      link: m.supplierProductId
        ? {
            supplierProductId: m.supplierProductId,
            supplierId: m.supplierId,
            supplierName: m.supplierName,
            material: m.material,
            unit: m.unit,
            unitPrice: str(m.unitPrice),
          }
        : undefined,
    })),
  };
}

function validate(d: Draft): string | null {
  if (!d.projectTitle.trim()) return "Give the project a title.";
  if (num(d.areaSqm) <= 0) return "Floor area must be greater than 0.";
  if (Math.round(num(d.floors)) < 1) return "A project needs at least 1 floor.";
  if (Math.round(num(d.timelineMonths)) < 1) return "Timeline must be at least 1 month.";
  if (d.phases.some((p) => !p.name.trim())) return "Every phase needs a name — or remove the empty one.";
  if (d.materials.some((m) => !m.material.trim())) return "Every material needs a name — or remove the empty one.";
  if (d.materials.some((m) => num(m.qty) <= 0)) return "Every material needs a quantity greater than 0.";
  if (d.breakdown.reduce((s, b) => s + num(b.amount), 0) <= 0) return "Enter at least one budget amount.";
  return null;
}

function toPlan(d: Draft, base: ConstructionPlan): ConstructionPlan {
  const renamedPhases = new Map(d.phases.filter((p) => p.origName).map((p) => [p.origName as string, p.name.trim()]));
  const budgetBreakdown = d.breakdown.map((b) => ({ category: b.category, amount: Math.max(0, Math.round(num(b.amount))) }));
  return {
    ...base,
    projectTitle: d.projectTitle.trim(),
    location: d.location.trim(),
    areaSqm: num(d.areaSqm),
    floors: Math.round(num(d.floors)),
    bedrooms: Math.max(0, Math.round(num(d.bedrooms))),
    bathrooms: Math.max(0, Math.round(num(d.bathrooms))),
    garageCars: Math.min(10, Math.max(0, Math.round(num(d.garageCars)))),
    designStyle: d.designStyle.trim(),
    budget: Math.max(0, Math.round(num(d.budget))),
    timelineMonths: Math.round(num(d.timelineMonths)),
    exteriorConcept: d.exteriorConcept.trim(),
    interiorConcept: d.interiorConcept.trim(),
    phases: d.phases.map((p) => ({
      name: p.name.trim(),
      percentComplete: Math.min(100, Math.max(0, num(p.share))),
      // Blank = no estimate; the backend then schedules this phase by its share instead.
      durationWeeks: Math.round(num(p.weeks)) >= 1 ? Math.round(num(p.weeks)) : undefined,
      tasks: p.tasks
        .split("\n")
        .map((t) => t.trim())
        .filter(Boolean),
    })),
    budgetBreakdown,
    materials: d.materials.map((m) => {
      const line = {
        material: m.material.trim(),
        category: m.category.trim() || "Other",
        qty: num(m.qty),
        unit: m.unit.trim() || "pcs",
        unitPrice: Math.max(0, num(m.unitPrice)),
        // A renamed phase must not strand the materials that were scheduled to it.
        ...(m.phase ? { phase: renamedPhases.get(m.phase) ?? m.phase } : {}),
      };
      // Still the supplier's own name, unit and price → keep the link. Changed by hand → it's now the
      // homeowner's number, so drop the link rather than have the AI overwrite it with the listing's.
      const l = m.link;
      const untouched =
        !!l && line.material === l.material && line.unit === l.unit && str(line.unitPrice) === l.unitPrice;
      return untouched
        ? { ...line, supplierProductId: l.supplierProductId, supplierId: l.supplierId, supplierName: l.supplierName }
        : line;
    }),
    totalEstimate: budgetBreakdown.reduce((s, b) => s + b.amount, 0),
  };
}

/**
 * Lets the homeowner change the AI's plan by hand instead of only by asking in chat. Mount it only
 * while editing (with a fresh `plan`) — the draft is seeded once from the plan on mount, so a
 * cancelled edit leaves nothing behind.
 */
export default function PlanEditorSheet({
  plan,
  initialTab = "details",
  onClose,
  onSave,
}: {
  plan: ConstructionPlan;
  initialTab?: PlanEditorTab;
  onClose: () => void;
  onSave: (next: ConstructionPlan) => void;
}) {
  const { chrome } = useTheme();
  const [tab, setTab] = useState<PlanEditorTab>(initialTab);
  const [draft, setDraft] = useState<Draft>(() => toDraft(plan));
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const patchAt = <K extends "phases" | "breakdown" | "materials">(key: K, index: number, patch: Partial<Draft[K][number]>) =>
    setDraft((d) => ({ ...d, [key]: d[key].map((row, i) => (i === index ? { ...row, ...patch } : row)) }));
  const removeAt = (key: "phases" | "materials", index: number) =>
    setDraft((d) => ({ ...d, [key]: d[key].filter((_, i) => i !== index) }));

  const breakdownTotal = draft.breakdown.reduce((s, b) => s + num(b.amount), 0);

  const save = () => {
    const problem = validate(draft);
    if (problem) {
      setError(problem);
      return;
    }
    onSave(toPlan(draft, plan));
  };

  return (
    <Sheet visible title="Edit Plan" subtitle="Your changes replace the AI's numbers and are used for any further AI updates." onClose={onClose}>
      <View className="flex-row gap-2">
        {TABS.map(({ key, label }) => {
          const active = key === tab;
          return (
            <Pressable
              key={key}
              onPress={() => setTab(key)}
              className="flex-1 py-2 rounded-xl items-center border"
              style={{ backgroundColor: active ? "#f59e0b20" : chrome.muted, borderColor: active ? "#f59e0b" : chrome.border }}
            >
              <Text className="text-xs font-semibold" style={{ color: active ? "#f59e0b" : chrome.mutedForeground }}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {tab === "details" && (
        <>
          <Field label="Project title" value={draft.projectTitle} onChangeText={(v) => set("projectTitle", v)} />
          <Field label="Location" value={draft.location} onChangeText={(v) => set("location", v)} placeholder="City / region" />
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Field label="Floor area (sqm)" keyboardType="numeric" value={draft.areaSqm} onChangeText={(v) => set("areaSqm", v)} />
            </View>
            <View className="flex-1">
              <Field label="Floors" keyboardType="number-pad" value={draft.floors} onChangeText={(v) => set("floors", v)} />
            </View>
          </View>
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Field label="Bedrooms" keyboardType="number-pad" value={draft.bedrooms} onChangeText={(v) => set("bedrooms", v)} />
            </View>
            <View className="flex-1">
              <Field label="Bathrooms" keyboardType="number-pad" value={draft.bathrooms} onChangeText={(v) => set("bathrooms", v)} />
            </View>
          </View>
          <Field
            label="Garage (cars it fits, 0 = none)"
            keyboardType="number-pad"
            value={draft.garageCars}
            onChangeText={(v) => set("garageCars", v)}
          />
          <Field label="Design style" value={draft.designStyle} onChangeText={(v) => set("designStyle", v)} />
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Field
                label="Your budget (₱)"
                keyboardType="numeric"
                value={draft.budget}
                onChangeText={(v) => set("budget", v)}
                placeholder="Not set"
              />
            </View>
            <View className="flex-1">
              <Field label="Timeline (months)" keyboardType="number-pad" value={draft.timelineMonths} onChangeText={(v) => set("timelineMonths", v)} />
            </View>
          </View>
          <Field label="Exterior concept" multiline value={draft.exteriorConcept} onChangeText={(v) => set("exteriorConcept", v)} />
          <Field label="Interior concept" multiline value={draft.interiorConcept} onChangeText={(v) => set("interiorConcept", v)} />
        </>
      )}

      {tab === "phases" && (
        <>
          {draft.phases.map((p, i) => (
            <View key={i} className="rounded-2xl p-3 bg-muted border border-border" style={{ gap: 12 }}>
              <View className="flex-row items-end gap-3">
                <View className="flex-1">
                  <Field label={`Phase ${i + 1}`} value={p.name} onChangeText={(v) => patchAt("phases", i, { name: v })} />
                </View>
                <Pressable onPress={() => removeAt("phases", i)} hitSlop={8} className="pb-3" accessibilityLabel="Remove phase">
                  <Ionicons name="trash-outline" size={20} color="#ef4444" />
                </Pressable>
              </View>
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Field label="Share %" keyboardType="numeric" value={p.share} onChangeText={(v) => patchAt("phases", i, { share: v })} />
                </View>
                <View className="flex-1">
                  <Field
                    label="Duration (weeks)"
                    keyboardType="number-pad"
                    value={p.weeks}
                    onChangeText={(v) => patchAt("phases", i, { weeks: v })}
                    placeholder="Auto"
                  />
                </View>
              </View>
              <Field
                label="Tasks (one per line)"
                multiline
                value={p.tasks}
                onChangeText={(v) => patchAt("phases", i, { tasks: v })}
              />
            </View>
          ))}
          <Button
            variant="tint"
            color="#f59e0b"
            label="+ Add phase"
            onPress={() => setDraft((d) => ({ ...d, phases: [...d.phases, { name: "", share: "", weeks: "", tasks: "" }] }))}
          />
        </>
      )}

      {tab === "budget" && (
        <>
          <InfoBox color="#f59e0b">The total estimate is the sum of these six categories.</InfoBox>
          {draft.breakdown.map((b, i) => {
            const meta = budgetCategoryMeta(b.category);
            return (
              <View key={b.category}>
                <View className="flex-row items-center gap-2 mb-1">
                  <Ionicons name={meta.icon} size={14} color={meta.color} />
                  <Text className="text-xs text-muted-foreground flex-1" numberOfLines={1}>
                    {meta.description || b.category}
                  </Text>
                </View>
                <Field label={`${b.category} (₱)`} keyboardType="numeric" value={b.amount} onChangeText={(v) => patchAt("breakdown", i, { amount: v })} />
              </View>
            );
          })}
          <View className="flex-row items-center justify-between rounded-xl px-4 py-3 bg-muted">
            <Text className="text-sm font-bold text-foreground">Total estimate</Text>
            <Text className="text-sm font-bold" style={{ color: "#f59e0b" }}>
              {peso(breakdownTotal)}
            </Text>
          </View>
        </>
      )}

      {tab === "materials" && (
        <>
          {draft.materials.map((m, i) => (
            <View key={i} className="rounded-2xl p-3 bg-muted border border-border" style={{ gap: 12 }}>
              <View className="flex-row items-end gap-3">
                <View className="flex-1">
                  <Field label={`Material ${i + 1}`} value={m.material} onChangeText={(v) => patchAt("materials", i, { material: v })} />
                </View>
                <Pressable onPress={() => removeAt("materials", i)} hitSlop={8} className="pb-3" accessibilityLabel="Remove material">
                  <Ionicons name="trash-outline" size={20} color="#ef4444" />
                </Pressable>
              </View>
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Field label="Qty" keyboardType="numeric" value={m.qty} onChangeText={(v) => patchAt("materials", i, { qty: v })} />
                </View>
                <View className="flex-1">
                  <Field label="Unit" value={m.unit} onChangeText={(v) => patchAt("materials", i, { unit: v })} />
                </View>
                <View className="flex-1">
                  <Field label="Unit price (₱)" keyboardType="numeric" value={m.unitPrice} onChangeText={(v) => patchAt("materials", i, { unitPrice: v })} />
                </View>
              </View>
              <Text className="text-xs text-right text-muted-foreground">Line total {peso(num(m.qty) * num(m.unitPrice))}</Text>
            </View>
          ))}
          <Button
            variant="tint"
            color="#f59e0b"
            label="+ Add material"
            onPress={() =>
              setDraft((d) => ({
                ...d,
                materials: [...d.materials, { material: "", category: "Other", qty: "", unit: "", unitPrice: "" }],
              }))
            }
          />
        </>
      )}

      {error && <Text className="text-xs text-danger">{error}</Text>}
      <SubmitButton label="Save changes" onPress={save} />
    </Sheet>
  );
}
