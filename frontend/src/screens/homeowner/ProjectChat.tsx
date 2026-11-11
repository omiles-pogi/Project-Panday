import { useCallback, useEffect, useRef, useState, type ComponentRef } from "react";
import {
  Text,
  View,
  TextInput,
  Pressable,
  ScrollView,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { usePlan, type ApprovalStage } from "@/context/PlanContext";
import { useTheme } from "@/context/ThemeContext";
import type { ChatHistoryMessage } from "@/services/ai/client";
import type { ConstructionPlan, SupplierCategory, SupplierOption, SupplierSelections } from "@/types/plan";
import SupplierPicker, { selectionsOf } from "@/components/SupplierPicker";
import BudgetCategoryBreakdown from "@/components/BudgetCategoryBreakdown";
import { CountUp } from "@/components/charts";
import { peso, pesoCompact } from "@/utils/currency";
import { compareBudget } from "@/utils/budget";
import { timelineLabel } from "@/utils/timeline";
import { garageLabel } from "@/utils/garage";
import { createProject, fetchDashboard, fetchMyHomeownerProjects, startProjectFromPlan } from "@/services/api/projects";
import type { ProjectSummary } from "@/types/project";
import Mascot from "@/components/Mascot";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useKeyboardState, useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import PlanEditorSheet, { type PlanEditorTab } from "@/components/PlanEditorSheet";
import ExportPdfButton from "@/components/ExportPdfButton";
import { planPdfHtml, sharePdf } from "@/utils/pdf";
import { timeAgo } from "@/utils/chatTime";
import * as Clipboard from "expo-clipboard";
import ProjectNamePrompt from "@/components/ProjectNamePrompt";

type IconName = keyof typeof Ionicons.glyphMap;

type MsgRole = "user" | "ai";
type CardType = "plan" | "budget" | "materials" | "summary";

interface ChatMessage {
  id: number;
  role: MsgRole;
  text: string;
  card?: CardType;
  quickReplies?: string[];
  typing?: boolean;
  createdAt: string;
}

let uid = 100;
const nextId = () => ++uid;
const now = () => new Date().toISOString();

function Chip({ text, onPress }: { text: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="px-3 py-1.5 rounded-full"
      style={{ backgroundColor: "#f59e0b15", borderWidth: 1, borderColor: "#f59e0b30" }}
    >
      <Text className="text-xs font-medium" style={{ color: "#f59e0b" }}>
        {text}
      </Text>
    </Pressable>
  );
}

function SectionHeader({ icon, title, badge }: { icon: IconName; title: string; badge?: string }) {
  return (
    <View className="flex-row items-center gap-2">
      <Ionicons name={icon} size={16} color="#f59e0b" />
      <Text className="font-bold text-sm text-foreground">{title}</Text>
      {badge && (
        <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: "#f59e0b20" }}>
          <Text className="text-xs font-semibold" style={{ color: "#f59e0b" }}>
            {badge}
          </Text>
        </View>
      )}
    </View>
  );
}

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <View className="rounded-2xl overflow-hidden bg-secondary border border-border">{children}</View>
  );
}

function CardHeader({ children }: { children: React.ReactNode }) {
  const { chrome } = useTheme();
  return (
    <View
      className="px-4 py-3 border-b flex-row items-center justify-between"
      style={{ borderColor: chrome.border, backgroundColor: chrome.muted }}
    >
      {children}
    </View>
  );
}

/* PLAN OVERVIEW CARD */
function PlanCard({ plan, onNext, onEdit }: { plan: ConstructionPlan; onNext: () => void; onEdit: () => void }) {
  const { chrome } = useTheme();
  // Every item starts approved — tapping a tile disapproves it (and tapping again re-approves),
  // so "what's left to review" is whatever the homeowner has actively flagged, not everything.
  const [disapproved, setDisapproved] = useState<Record<string, boolean>>({});
  const cmp = compareBudget(plan.budget, plan.totalEstimate);
  const materialsTotal = plan.materials.reduce((s, m) => s + m.qty * m.unitPrice, 0);
  const phaseNames = plan.phases.map((p) => p.name);
  // Bounded summaries instead of joining a whole (potentially long) list into one line — the raw
  // join used to get cut off mid-word on narrow screens, which read as messy rather than organized.
  const phasesDetail =
    phaseNames.length > 2 ? `${phaseNames.slice(0, 2).join(", ")} +${phaseNames.length - 2} more` : phaseNames.join(", ");
  const items: { icon: IconName; title: string; value: string; detail: string; color: string }[] = [
    { icon: "calendar-outline", title: "Timeline", value: timelineLabel(plan.timelineValue, plan.timelineUnit), detail: `${plan.phases.length} phases planned`, color: "#3b82f6" },
    {
      icon: "wallet-outline",
      title: "AI Cost Estimate",
      value: peso(plan.totalEstimate),
      detail: !cmp.hasBudget
        ? "You haven't set a budget yet"
        : cmp.difference >= 0
          ? `Your budget ${peso(plan.budget)} · ${peso(cmp.difference)} to spare`
          : `Your budget ${peso(plan.budget)} · short by ${peso(-cmp.difference)}`,
      color: "#f59e0b",
    },
    { icon: "layers-outline", title: "Key Materials", value: `${plan.materials.length} material types`, detail: `Est. ${peso(materialsTotal)} total`, color: "#10b981" },
    {
      icon: "home-outline",
      title: "Design",
      value: plan.designStyle,
      detail: [`${plan.bedrooms}BR / ${plan.bathrooms}BA`, garageLabel(plan.garageCars), plan.areaSqm > 0 ? `${plan.areaSqm} sqm` : "No floor area added"]
        .filter(Boolean)
        .join(" · "),
      color: "#8b5cf6",
    },
    { icon: "git-branch-outline", title: "Phases", value: `${plan.phases.length} phases`, detail: phasesDetail, color: "#06b6d4" },
  ];
  const disapprovedItems = items.filter((i) => disapproved[i.title]);
  const allApproved = disapprovedItems.length === 0;

  const toggle = (title: string) => setDisapproved((p) => ({ ...p, [title]: !p[title] }));

  return (
    <CardShell>
      <CardHeader>
        <SectionHeader icon="sparkles-outline" title="Construction Plan Overview" badge="AI Generated" />
      </CardHeader>
      <Text className="px-4 pt-1 pb-2 text-xs text-muted-foreground">
        Tap anything you want to change — disapproved items stay flagged until you ask the AI to adjust them.
      </Text>
      <View className="px-4 pb-2" style={{ gap: 8 }}>
        {items.map((item) => {
          const isDisapproved = !!disapproved[item.title];
          return (
            <Pressable
              key={item.title}
              onPress={() => toggle(item.title)}
              className="rounded-xl p-3 flex-row items-center gap-3"
              style={{
                backgroundColor: isDisapproved ? "#ef444412" : `${item.color}12`,
                borderWidth: 1,
                borderColor: isDisapproved ? "#ef444460" : `${item.color}50`,
              }}
            >
              <Ionicons name={isDisapproved ? "close-circle" : item.icon} size={18} color={isDisapproved ? "#ef4444" : item.color} />
              <View className="flex-1">
                <Text className="text-xs font-semibold mb-0.5" style={{ color: isDisapproved ? "#ef4444" : item.color }} numberOfLines={1}>
                  {item.title.toUpperCase()}
                </Text>
                {item.value.startsWith("₱") ? (
                  <CountUp text={item.value} className="font-bold text-sm text-foreground" numberOfLines={1} />
                ) : (
                  <Text className="font-bold text-sm text-foreground" numberOfLines={1}>
                    {item.value}
                  </Text>
                )}
                <Text className="text-xs mt-0.5 leading-4 text-muted-foreground" numberOfLines={2}>
                  {item.detail}
                </Text>
              </View>
              <Ionicons
                name={isDisapproved ? "close" : "checkmark-circle"}
                size={16}
                color={isDisapproved ? "#ef4444" : "#10b981"}
              />
            </Pressable>
          );
        })}
      </View>
      <View className="px-4 pb-4" style={{ gap: 8 }}>
        <Pressable
          onPress={onEdit}
          className="py-2 rounded-xl items-center flex-row justify-center gap-1.5 border"
          style={{ backgroundColor: "#f59e0b15", borderColor: "#f59e0b30" }}
        >
          <Ionicons name="create-outline" size={15} color="#f59e0b" />
          <Text className="text-sm font-semibold" style={{ color: "#f59e0b" }}>
            Edit Plan Yourself
          </Text>
        </Pressable>
        {!allApproved && (
          <Text className="text-xs text-danger">
            Disapproved: {disapprovedItems.map((i) => i.title).join(", ")}. Tap to re-approve, or tell the AI what to change below.
          </Text>
        )}
        {allApproved ? (
          <Pressable onPress={onNext} className="py-2.5 rounded-xl items-center bg-primary">
            <Text className="text-sm font-bold text-primary-foreground">Continue to Budget Breakdown →</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => setDisapproved({})}
            className="py-2 rounded-xl items-center flex-row justify-center gap-1.5 bg-muted border border-border"
          >
            <Ionicons name="checkmark" size={15} color={chrome.mutedForeground} />
            <Text className="text-sm font-semibold text-muted-foreground">Re-approve All</Text>
          </Pressable>
        )}
      </View>
    </CardShell>
  );
}

/* BUDGET CARD */
function BudgetCard({ plan, onNext, onEdit }: { plan: ConstructionPlan; onNext: () => void; onEdit: () => void }) {
  const { chrome } = useTheme();
  const cmp = compareBudget(plan.budget, plan.totalEstimate);

  return (
    <CardShell>
      <CardHeader>
        <SectionHeader icon="wallet-outline" title="Budget Breakdown" badge="AI Estimate" />
      </CardHeader>
      <View className="p-4">
        <View className="flex-row gap-2 mb-4">
          {[
            { label: "Your Budget", value: cmp.hasBudget ? pesoCompact(plan.budget) : "Not set", color: chrome.mutedForeground },
            { label: "AI Estimate", value: pesoCompact(plan.totalEstimate), color: "#f59e0b" },
            cmp.hasBudget
              ? {
                  label: cmp.difference >= 0 ? "To Spare" : "Short By",
                  value: pesoCompact(Math.abs(cmp.difference)),
                  color: cmp.difference >= 0 ? "#10b981" : "#ef4444",
                }
              : { label: "Difference", value: "—", color: chrome.mutedForeground },
          ].map(({ label, value, color }) => (
            <View key={label} className="flex-1 p-3 rounded-xl items-center bg-muted">
              <Text className="text-xs mb-1 text-muted-foreground" numberOfLines={1}>
                {label}
              </Text>
              <Text className="font-bold text-sm" style={{ color }} numberOfLines={1}>
                {value}
              </Text>
            </View>
          ))}
        </View>
        <View className="mb-4">
          <BudgetCategoryBreakdown breakdown={plan.budgetBreakdown} materials={plan.materials} />
        </View>
        <View className="flex-row gap-2">
          <Pressable onPress={onNext} className="flex-1 py-2.5 rounded-xl items-center flex-row justify-center gap-1.5 bg-primary">
            <Ionicons name="checkmark" size={15} color="#0f1117" />
            <Text className="text-sm font-bold text-primary-foreground">Approve Budget</Text>
          </Pressable>
          <Pressable onPress={onEdit} className="px-4 py-2.5 rounded-xl items-center bg-muted border border-border">
            <Text className="text-sm text-muted-foreground">Modify</Text>
          </Pressable>
        </View>
        <View className="mt-2">
          <ExportPdfButton label="Export Plan PDF" onExport={() => sharePdf(planPdfHtml(plan), `${plan.projectTitle} plan`)} />
        </View>
      </View>
    </CardShell>
  );
}

/* MATERIALS CARD */
function MaterialsCard({
  plan,
  onNext,
  onEdit,
  onChooseSupplier,
  busy,
}: {
  plan: ConstructionPlan;
  onNext: () => void;
  onEdit: () => void;
  onChooseSupplier: (category: SupplierCategory, supplier: SupplierOption | null) => void;
  busy: boolean;
}) {
  const { chrome } = useTheme();
  const [approved, setApproved] = useState<Record<number, boolean>>({});
  const total = plan.materials.reduce((s, m) => s + m.qty * m.unitPrice, 0);
  const allApproved = plan.materials.every((_, i) => approved[i]);

  return (
    <CardShell>
      <CardHeader>
        <SectionHeader icon="layers-outline" title="Material Estimates" badge="AI Generated" />
        <CountUp text={peso(total)} className="text-sm font-bold" style={{ color: "#f59e0b" }} />
      </CardHeader>
      <View className="p-4 border-b" style={{ borderColor: chrome.border }}>
        <SupplierPicker plan={plan} onChoose={onChooseSupplier} disabled={busy} />
      </View>
      <View className="px-4 py-2" style={{ maxHeight: 260 }}>
        <ScrollView>
          {plan.materials.map((m, i) => (
            <View
              key={i}
              className="flex-row items-center justify-between py-2 border-b"
              style={{ borderColor: chrome.border }}
            >
              <View className="flex-1 pr-2">
                <Text className="text-xs font-medium text-foreground">{m.material}</Text>
                <Text className="text-xs text-muted-foreground">
                  {m.qty.toLocaleString()} {m.unit} × {peso(m.unitPrice)}
                </Text>
                <Text className="text-xs" style={{ color: m.supplierName ? "#10b981" : chrome.mutedForeground }}>
                  {m.supplierName ? `From ${m.supplierName}` : "AI estimate"}
                  {m.phase ? ` · ${m.phase}` : ""}
                </Text>
              </View>
              <Text className="text-xs font-semibold mr-2" style={{ color: "#f59e0b" }}>
                {peso(m.qty * m.unitPrice)}
              </Text>
              <Pressable
                onPress={() => setApproved((p) => ({ ...p, [i]: !p[i] }))}
                className="px-2 py-1 rounded"
                style={{ backgroundColor: approved[i] ? "#10b98120" : chrome.muted }}
              >
                {approved[i] ? (
                  <Ionicons name="checkmark" size={13} color="#10b981" />
                ) : (
                  <Text className="text-xs font-medium" style={{ color: chrome.mutedForeground }}>
                    OK
                  </Text>
                )}
              </Pressable>
            </View>
          ))}
        </ScrollView>
      </View>
      <View className="p-4 border-t" style={{ borderColor: chrome.border }}>
        <View className="flex-row gap-1.5 mb-3">
          <Ionicons name="warning-outline" size={13} color={chrome.mutedForeground} style={{ marginTop: 1 }} />
          <Text className="text-xs flex-1 text-muted-foreground">
            Items marked &quot;From …&quot; use that supplier&apos;s real listed price. The rest are AI estimates; actual
            costs may vary with the supplier and market conditions.
          </Text>
        </View>
        <Pressable
          onPress={onEdit}
          className="py-2 mb-2 rounded-xl items-center bg-muted border border-border flex-row justify-center gap-1.5"
        >
          <Ionicons name="create-outline" size={15} color={chrome.mutedForeground} />
          <Text className="text-sm text-muted-foreground">Edit Materials</Text>
        </Pressable>
        <View className="flex-row gap-2">
          <Pressable
            onPress={() => setApproved(Object.fromEntries(plan.materials.map((_, i) => [i, true])))}
            className="flex-1 py-2.5 rounded-xl items-center flex-row justify-center gap-1.5"
            style={{ backgroundColor: allApproved ? chrome.muted : "#f59e0b15", borderWidth: 1, borderColor: "#f59e0b30" }}
          >
            <Ionicons name="checkmark" size={15} color={allApproved ? chrome.mutedForeground : "#f59e0b"} />
            <Text className="text-sm font-semibold" style={{ color: allApproved ? chrome.mutedForeground : "#f59e0b" }}>
              {allApproved ? "All Approved" : "Approve All Materials"}
            </Text>
          </Pressable>
          {allApproved && (
            <Pressable onPress={onNext} className="flex-1 py-2.5 rounded-xl items-center bg-primary">
              <Text className="text-sm font-bold text-primary-foreground">Finalize</Text>
            </Pressable>
          )}
        </View>
      </View>
    </CardShell>
  );
}

/* SUMMARY CARD */
function SummaryCard({ plan }: { plan: ConstructionPlan }) {
  const { chrome } = useTheme();
  return (
    <View className="rounded-2xl overflow-hidden" style={{ backgroundColor: chrome.secondary, borderWidth: 1, borderColor: "#10b98140" }}>
      <View className="px-4 py-3 border-b flex-row items-center gap-2" style={{ borderColor: "#10b98130", backgroundColor: "#10b98112" }}>
        <Ionicons name="trophy-outline" size={18} color="#10b981" />
        <Text className="font-bold text-sm" style={{ color: "#10b981" }}>
          Project Plan Complete
        </Text>
      </View>
      <View className="p-4">
        <View style={{ gap: 8 }} className="mb-4">
          {["Construction Plan", "Budget Breakdown", "Material Estimates"].map((label) => (
            <View key={label} className="flex-row items-center justify-between px-3 py-2 rounded-lg bg-muted">
              <Text className="text-sm text-muted-foreground">{label}</Text>
              <View className="flex-row items-center gap-1">
                <Ionicons name="checkmark" size={13} color="#10b981" />
                <Text className="text-xs font-semibold" style={{ color: "#10b981" }}>
                  Approved
                </Text>
              </View>
            </View>
          ))}
        </View>
        <View className="flex-row gap-2 mb-4">
          <View className="flex-1 p-3 rounded-xl items-center bg-muted">
            <Text className="text-xs mb-1 text-muted-foreground">Total AI Estimate</Text>
            <CountUp text={peso(plan.totalEstimate)} className="font-bold text-base" style={{ color: "#f59e0b" }} />
          </View>
          <View className="flex-1 p-3 rounded-xl items-center bg-muted">
            <Text className="text-xs mb-1 text-muted-foreground">Project Duration</Text>
            <Text className="font-bold text-base" style={{ color: "#3b82f6" }}>
              {timelineLabel(plan.timelineValue, plan.timelineUnit)}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={() => router.push("/homeowner/marketplace" as never)}
          className="py-2.5 rounded-xl items-center bg-primary"
        >
          <Text className="text-sm font-bold text-primary-foreground">Find Your Team →</Text>
        </Pressable>
      </View>
    </View>
  );
}

const STARTER_PROMPTS = [
  "3-bedroom house in Quezon City, 120 sqm, ₱2.5M budget, modern design",
  "Repaint and renovate my kitchen, ₱150K budget",
  "Add a second floor to my house, modern design",
];

function timeGreeting(): { text: string; icon: IconName } {
  const hour = new Date().getHours();
  if (hour < 12) return { text: "Good morning", icon: "sunny-outline" };
  if (hour < 18) return { text: "Good afternoon", icon: "partly-sunny-outline" };
  return { text: "Good evening", icon: "moon-outline" };
}

function RecentProjectCard({ project, onPress }: { project: ProjectSummary; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="w-36 p-3 rounded-2xl mr-3 bg-card border border-border">
      <View className="w-full h-14 rounded-xl mb-2 items-center justify-center" style={{ backgroundColor: "#f59e0b15" }}>
        <Ionicons name="hammer-outline" size={20} color="#f59e0b" />
      </View>
      <Text numberOfLines={1} className="text-xs font-semibold text-foreground">
        {project.title}
      </Text>
      <Text className="text-xs mt-0.5 text-muted-foreground">{project.overallProgressPct}% complete</Text>
    </Pressable>
  );
}

function Dots() {
  return (
    <View className="flex-row items-center gap-1 px-4 py-3">
      {[0, 1, 2].map((i) => (
        <View key={i} className="w-2 h-2 rounded-full" style={{ backgroundColor: "#f59e0b", opacity: 0.4 + i * 0.2 }} />
      ))}
    </View>
  );
}

type Stage = "idle" | "generating" | ApprovalStage;
type ResolvedStage = ApprovalStage;

const STAGE_TEXT: Record<ResolvedStage, (p: ConstructionPlan) => string> = {
  plan: (p) => `Here's your construction plan for ${p.projectTitle}. Review each section below, or approve everything at once.`,
  budget: (p) => {
    const estimate = pesoCompact(p.totalEstimate);
    if (!(p.budget > 0)) {
      return `Budget breakdown ready. My estimate for this scope is ${estimate}. Tell me your budget (e.g. "my budget is ₱2.5M") and I'll compare it.`;
    }
    const yours = pesoCompact(p.budget);
    return p.budget >= p.totalEstimate
      ? `Budget breakdown ready. Your budget of ${yours} covers my ${estimate} estimate.`
      : `Budget breakdown ready. Your budget of ${yours} is below my ${estimate} estimate — you may want to adjust the scope or the budget.`;
  },
  materials: () => "Material estimates below. Linked items use saved supplier prices; other prices and all proposed quantities are estimates.",
  summary: (p) => `All sections approved. Your construction plan for ${p.projectTitle} has been finalized.`,
};

const STAGE_ORDER: ResolvedStage[] = ["plan", "budget", "materials", "summary"];
const NEXT_LABEL: Record<ResolvedStage, string> = {
  plan: "Show me the detailed budget breakdown",
  budget: "Looks good, show me the material list",
  materials: "Everything looks great. Finalize my project plan.",
  summary: "",
};

/**
 * Rebuilds the visible chat thread from PlanContext's persistent history when this screen
 * (re)mounts — e.g. after navigating to Find Your Team and back. Without this, the conversation
 * looks "deleted" because this component's own message bubbles are local state that starts over
 * on every mount, even though the underlying plan and AI conversation are still intact in context.
 * Resuming at `stage` (also persisted in context) is what makes it reopen on whatever approval
 * step the homeowner was actually on, instead of snapping back to the Plan Overview card.
 */
function reconstructMessages(
  plan: ConstructionPlan | null,
  history: ChatHistoryMessage[],
  stage: ApprovalStage | null
): ChatMessage[] {
  if (history.length === 0) {
    return [];
  }
  const rebuilt: ChatMessage[] = [];
  history.forEach((m, i) => {
    const isLastAssistantTurn = m.role === "assistant" && i === history.length - 1;
    rebuilt.push({
      id: nextId(),
      role: m.role === "user" ? "user" : "ai",
      text: m.content,
      createdAt: now(),
      card: isLastAssistantTurn && plan ? stage ?? "plan" : undefined,
    });
  });
  return rebuilt;
}

function AIBubble({
  msg,
  plan,
  onQuickReply,
  onAdvance,
  onEdit,
  onChooseSupplier,
  busy,
}: {
  msg: ChatMessage;
  plan: ConstructionPlan | null;
  onQuickReply: (text: string) => void;
  onAdvance: () => void;
  onEdit: (tab: PlanEditorTab) => void;
  onChooseSupplier: (category: SupplierCategory, supplier: SupplierOption | null) => void;
  busy: boolean;
}) {
  const { chrome } = useTheme();
  const [copied, setCopied] = useState(false);
  const copyText = async () => {
    await Clipboard.setStringAsync(msg.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <View className="flex-row gap-3 items-start mb-4">
      <Mascot size={44} mood={msg.typing ? "thinking" : "happy"} bob={msg.typing} />
      <View className="flex-1" style={{ gap: 6 }}>
        {msg.typing ? (
          <View className="rounded-2xl self-start bg-card border border-border">
            <Dots />
          </View>
        ) : (
          <>
            <View className="rounded-2xl px-4 py-3 self-start bg-card border border-border" style={{ maxWidth: "100%" }}>
              <Text className="text-sm leading-relaxed text-card-foreground">{msg.text}</Text>
            </View>
            <View className="flex-row items-center gap-3 px-1">
              <Pressable onPress={copyText} hitSlop={8}>
                <Ionicons name={copied ? "checkmark" : "copy-outline"} size={13} color={chrome.mutedForeground} />
              </Pressable>
              <Text className="text-xs text-muted-foreground">{copied ? "Copied" : timeAgo(msg.createdAt)}</Text>
            </View>
          </>
        )}
        {!msg.typing && plan && msg.card === "plan" && <PlanCard plan={plan} onNext={onAdvance} onEdit={() => onEdit("details")} />}
        {!msg.typing && plan && msg.card === "budget" && <BudgetCard plan={plan} onNext={onAdvance} onEdit={() => onEdit("budget")} />}
        {!msg.typing && plan && msg.card === "materials" && (
          <MaterialsCard
            plan={plan}
            onNext={onAdvance}
            onEdit={() => onEdit("materials")}
            onChooseSupplier={onChooseSupplier}
            busy={busy}
          />
        )}
        {!msg.typing && plan && msg.card === "summary" && <SummaryCard plan={plan} />}
        {!msg.typing && msg.quickReplies && (
          <View className="flex-row flex-wrap gap-2">
            {msg.quickReplies.map((r) => (
              <Chip key={r} text={r} onPress={() => onQuickReply(r)} />
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

function UserBubble({ msg }: { msg: ChatMessage }) {
  return (
    <View className="items-end mb-4">
      <View className="rounded-2xl px-4 py-3 bg-primary" style={{ maxWidth: "80%" }}>
        <Text className="text-sm leading-relaxed text-primary-foreground">{msg.text}</Text>
      </View>
      <Text className="text-xs mt-1 mr-1 text-muted-foreground">{timeAgo(msg.createdAt)}</Text>
    </View>
  );
}

export default function ProjectChat() {
  const { chrome } = useTheme();
  const insets = useSafeAreaInsets();
  const {
    plan,
    messages: planMessages,
    approvalStage,
    setApprovalStage,
    ready,
    activeProjectKey,
    restoredVersion,
    selectProject,
    linkToProject,
    send,
    updatePlan,
    getFinalizationKey,
    projectNaming,
    syncProjectNaming,
  } = usePlan();
  const [editorTab, setEditorTab] = useState<PlanEditorTab | null>(null);
  // The planner has no bottom bar. Preserve its single existing keyboard animation for
  // the shared conversation/composer container; do not layer another avoider or offset on it.
  const { height: keyboardHeight } = useReanimatedKeyboardAnimation();
  const liftStyle = useAnimatedStyle(() => ({ paddingBottom: Math.max(0, -keyboardHeight.value) }));
  const keyboardVisible = useKeyboardState((k) => k.isVisible);
  const [messages, setMessages] = useState<ChatMessage[]>(() => reconstructMessages(plan, planMessages, approvalStage));
  const [input, setInput] = useState("");
  const [stage, setStage] = useState<Stage>(() => approvalStage ?? (plan ? "plan" : "idle"));
  const [busy, setBusy] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [recentProjects, setRecentProjects] = useState<ProjectSummary[]>([]);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const operationRef = useRef(0);
  const finalizationInFlight = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (!ready) return;
      let cancelled = false;
      fetchMyHomeownerProjects()
        .then((list) => {
          if (!cancelled) setRecentProjects(list.slice(0, 6));
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, [ready])
  );

  // PlanContext's conversation loads from storage asynchronously (so it survives an app
  // restart, not just in-app navigation) and switches to a different project's own conversation
  // whenever one is selected elsewhere (e.g. the Dashboard's project tabs) — both land after this
  // component's own initial state is already computed, so this re-syncs whenever either happens,
  // instead of getting stuck showing a stale or empty conversation.
  useEffect(() => {
    if (!ready) return;
    operationRef.current += 1;
    // Resyncing local UI state from an external store (PlanContext's active conversation)
    // changing out from under this component — not a derived-state anti-pattern this rule
    // otherwise guards against.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMessages(reconstructMessages(plan, planMessages, approvalStage));
    setStage(approvalStage ?? (plan ? "plan" : "idle"));
    // This screen stays mounted across projects, so whatever was half-typed or being edited for the
    // previous one must not follow the user into the next.
    setInput("");
    setEditorTab(null);
    setBusy(false);
    return () => { operationRef.current += 1; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, activeProjectKey, restoredVersion]);

  useFocusEffect(useCallback(() => {
    if (!ready) return;
    let cancelled = false;
    const projectId = /^\d+$/.test(activeProjectKey) ? Number(activeProjectKey) : undefined;
    // Without a selected ID, leave the welcome/project chooser intact. Never fetch a default project.
    if (!projectId) return;
    fetchDashboard(projectId)
      .then(({ project }) => {
        if (cancelled) return;
        setSyncError(null);
        if (project?.id === projectId) {
          selectProject(project.id, project.approvedPlan, project.title);
          syncProjectNaming({ id: project.id, title: project.title, status: project.status, projectNamePending: project.projectNamePending ?? null });
        }
        else if (projectId) setSyncError("This project is no longer available. Select a project from Home.");
      })
      .catch((err) => {
        if (!cancelled) setSyncError(err instanceof Error ? err.message : "Could not refresh project data.");
      });
    return () => { cancelled = true; };
  }, [ready, activeProjectKey, selectProject, syncProjectNaming]));

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages, projectNaming?.projectId, projectNaming?.pending]);

  // onFocus alone only scrolled the first time the keyboard opened this screen. Tying it to the
  // keyboard's own visibility instead catches every later open too — but the keyboard's own
  // open/resize animation is still mid-flight at the moment this fires, so a single immediate call
  // scrolls to where the content ends *before* it's done shrinking to make room, landing short.
  // Repeating it while the animation plays (Android's keyboard animates ~250-300ms) keeps nudging
  // the scroll position to match, so it still lands at the true end once everything settles.
  useEffect(() => {
    if (!keyboardVisible) return;
    const scrollToEnd = () => scrollRef.current?.scrollToEnd({ animated: true });
    scrollToEnd();
    const interval = setInterval(scrollToEnd, 60);
    const timeout = setTimeout(() => clearInterval(interval), 400);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [keyboardVisible]);

  const resolveTyping = (id: number, update: Partial<ChatMessage>) => {
    setMessages((p) => p.map((m) => (m.id === id ? { ...m, ...update, typing: false } : m)));
  };

  // Every message goes through here — the AI itself decides whether to just chat, ask a
  // clarifying question, or submit/update the plan, so there's one handler instead of three.
  const handleSend = async (text: string, supplierSelections?: SupplierSelections) => {
    if (!text.trim() || busy || !ready) return;
    const operation = ++operationRef.current;
    const hadPlanBefore = !!plan;
    setMessages((p) => [...p, { id: nextId(), role: "user", text: text.trim(), createdAt: now() }]);
    setInput("");

    if (!hadPlanBefore) setStage("generating");
    setBusy(true);
    const typingId = nextId();
    setMessages((p) => [...p, { id: typingId, role: "ai", text: "", typing: true, createdAt: now() }]);

    // Fires live as a chat reply streams in — flips the dots off and appends text word-by-word,
    // like Claude/ChatGPT. Never fires for a plan/clarification (those stay as dots until done,
    // since there's no meaningful partial JSON to show).
    const onChunk = (partial: string) => {
      if (operation !== operationRef.current) return;
      setMessages((p) => p.map((m) => (m.id === typingId ? { ...m, text: m.text + partial, typing: false } : m)));
    };

    try {
      const result = await send(text.trim(), onChunk, supplierSelections ? { supplierSelections } : undefined);
      if (operation !== operationRef.current) return;

      if (result.type === "chat") {
        resolveTyping(typingId, { text: result.message });
        if (!hadPlanBefore) setStage("idle");
        return;
      }

      if (result.type === "clarification") {
        const list = result.questions.map((q, i) => `${i + 1}. ${q}`).join("\n");
        resolveTyping(typingId, { text: list });
        if (!hadPlanBefore) setStage("idle");
        return;
      }

      // A plan — either the first one, or an update. Stay on whatever section the homeowner
      // was looking at and show its refreshed card, instead of always jumping back to the overview.
      const cardStage: ResolvedStage =
        hadPlanBefore && stage !== "summary" && (STAGE_ORDER as string[]).includes(stage) ? (stage as ResolvedStage) : "plan";
      resolveTyping(typingId, { text: STAGE_TEXT[cardStage](result.plan), card: cardStage });
      setStage(cardStage);
      setApprovalStage(cardStage);
    } catch (err) {
      if (operation !== operationRef.current) return;
      const message = err instanceof Error ? err.message : "Something went wrong.";
      resolveTyping(typingId, { text: `Sorry: ${message}` });
      if (!hadPlanBefore) setStage("idle");
    } finally {
      if (operation === operationRef.current) setBusy(false);
    }
  };

  const advance = async () => {
    if (!plan || busy || finalizationInFlight.current) return;
    const currentIndex = STAGE_ORDER.indexOf(stage as ResolvedStage);
    const next = STAGE_ORDER[currentIndex + 1];
    if (!next) return;
    const operation = ++operationRef.current;
    const label = NEXT_LABEL[stage as ResolvedStage];

    if (next === "summary") {
      // Lock synchronously (before React rerenders) and persist one retry key before any POST.
      finalizationInFlight.current = true;
      setBusy(true);
      // A chat that belongs to a project already (the "not started yet" one New Project created)
      // fills that project in; only a chat with no project yet creates a new one.
      const placeholderId = /^\d+$/.test(activeProjectKey) ? Number(activeProjectKey) : null;
      try {
        const key = await getFinalizationKey();
        if (operation !== operationRef.current) return;
        const saved = placeholderId !== null ? await startProjectFromPlan(placeholderId, plan, key) : await createProject(plan, key);
        if (operation !== operationRef.current) return;
        setApprovalStage("summary");
        linkToProject(saved.id, saved.projectNamePending == null ? undefined : { projectId: saved.id, title: saved.title, pending: saved.projectNamePending });
        setMessages((previous) => [...previous,
          { id: nextId(), role: "user", text: label, createdAt: now() },
          { id: nextId(), role: "ai", text: STAGE_TEXT.summary({ ...plan, projectTitle: saved.title }), card: "summary", createdAt: now() },
        ]);
        setStage("summary");
      } catch {
        if (operation === operationRef.current) setMessages((previous) => [...previous, {
          id: nextId(), role: "ai", text: "I couldn't confirm that your plan was saved. Check your connection and try again; the retry will reuse the same project.", createdAt: now(),
        }]);
      } finally {
        finalizationInFlight.current = false;
        if (operation === operationRef.current) setBusy(false);
      }
      return;
    }

    setMessages((p) => [...p, { id: nextId(), role: "user", text: label, createdAt: now() }]);
    setBusy(true);
    const typingId = nextId();
    setMessages((p) => [...p, { id: typingId, role: "ai", text: "", typing: true, createdAt: now() }]);
    setTimeout(() => {
      if (operation !== operationRef.current) return;
      resolveTyping(typingId, { text: STAGE_TEXT[next](plan), card: next });
      setStage(next);
      setApprovalStage(next);
      setBusy(false);
    }, 650);
  };

  // Picking a supplier is a plan change like any other: the AI re-sources that category from the
  // supplier's real listings, and the server checks every line it returns against them.
  const handleChooseSupplier = (category: SupplierCategory, supplier: SupplierOption | null) => {
    if (!plan) return;
    handleSend(
      supplier ? `Use ${supplier.name} as my supplier for ${category}.` : `Use the best-priced supplier for ${category}.`,
      { ...selectionsOf(plan), [category]: supplier?.id ?? null }
    );
  };

  const handleSaveEdit = (next: ConstructionPlan) => {
    updatePlan(next);
    setEditorTab(null);
    setMessages((p) => [
      ...p,
      {
        id: nextId(),
        role: "ai",
        text: "Got it — I've applied your changes. Everything above now reflects your edited plan, and I'll build on it from here.",
        createdAt: now(),
      },
    ]);
  };

  const handleQuickReply = (text: string) => {
    if (stage === "idle") handleSend(text);
  };

  const showSuggestions = messages.length === 0;

  return (
    <View className="flex-1 bg-background">
    <Animated.View style={[{ flex: 1 }, liftStyle]}>
      <ScrollView ref={scrollRef} className="flex-1 px-4 py-5" contentContainerStyle={{ paddingBottom: 8 }}>
        {showSuggestions && (
          <View className="items-center" style={{ paddingTop: 16, paddingBottom: 28 }}>
            <Mascot size={72} />
            <View className="flex-row items-center gap-2 mt-3">
              <Ionicons name={timeGreeting().icon} size={20} color="#f59e0b" />
              <Text className="text-xl font-extrabold text-foreground">{timeGreeting().text}</Text>
            </View>
            <Text className="text-xs mt-1 mb-6 text-muted-foreground">
              I&apos;m PandAi — what are we building today?
            </Text>

            {recentProjects.length > 0 && (
              <View className="w-full mb-6">
                <View className="flex-row items-center justify-between px-1 mb-2">
                  <Text className="text-xs font-semibold text-muted-foreground">RECENT PROJECTS</Text>
                  <Pressable onPress={() => router.push("/homeowner" as never)}>
                    <Text className="text-xs font-semibold" style={{ color: "#f59e0b" }}>
                      View all
                    </Text>
                  </Pressable>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ height: 120 }}>
                  {recentProjects.map((p) => (
                    <RecentProjectCard
                      key={p.id}
                      project={p}
                      onPress={() => selectProject(p.id, undefined, p.title)}
                    />
                  ))}
                </ScrollView>
              </View>
            )}

            <View className="w-full" style={{ gap: 8 }}>
              {STARTER_PROMPTS.map((p) => (
                <Pressable
                  key={p}
                  onPress={() => handleSend(p)}
                  className="px-4 py-3 rounded-2xl bg-card border border-border flex-row items-center gap-2"
                >
                  <Ionicons name="sparkles-outline" size={14} color="#f59e0b" />
                  <Text className="text-xs text-foreground flex-1" numberOfLines={1}>
                    {p}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
        {messages.map((msg) =>
          msg.role === "ai" ? (
            <AIBubble
              key={msg.id}
              msg={msg}
              plan={plan}
              onQuickReply={handleQuickReply}
              onAdvance={advance}
              onEdit={setEditorTab}
              onChooseSupplier={handleChooseSupplier}
              busy={busy}
            />
          ) : (
            <UserBubble key={msg.id} msg={msg} />
          )
        )}
        {projectNaming && <ProjectNamePrompt key={projectNaming.projectId} naming={projectNaming} onSaved={syncProjectNaming} />}
      </ScrollView>

      {plan && editorTab && (
        <PlanEditorSheet plan={plan} initialTab={editorTab} onClose={() => setEditorTab(null)} onSave={handleSaveEdit} />
      )}

      {/* The bar never mounts in chat. Only protect the closed-keyboard composer from the
          system navigation inset; the existing keyboard animation remains the sole lift. */}
      <View className="px-4" style={{ paddingBottom: keyboardVisible ? 12 : 16 + insets.bottom, flexShrink: 0 }}>
        {syncError && <Text className="text-xs mb-2 text-danger">{syncError}</Text>}
        <View className="flex-row gap-3 items-end rounded-2xl p-3 bg-card border border-border">
          <TextInput
            value={input}
            onChangeText={setInput}
            multiline
            placeholder={
              busy
                ? "AI is thinking..."
                : plan
                  ? "Ask a question or request a change..."
                  : "Describe your project or ask a question..."
            }
            placeholderTextColor={chrome.mutedForeground}
            editable={!busy && ready}
            className="flex-1 text-sm text-foreground"
            style={{ minHeight: 24, maxHeight: 120 }}
          />
          <Pressable
            onPress={() => handleSend(input)}
            disabled={!input.trim() || busy || !ready}
            className="w-9 h-9 rounded-xl items-center justify-center"
            style={{ backgroundColor: input.trim() && !busy ? "#f59e0b" : chrome.muted }}
          >
            <Ionicons name="arrow-up" size={18} color={input.trim() && !busy ? "#0f1117" : chrome.mutedForeground} />
          </Pressable>
        </View>
        <Text className="text-xs text-center mt-2 text-muted-foreground">
          AI recommends · You decide · All items require your approval
        </Text>
      </View>
    </Animated.View>
    </View>
  );
}
