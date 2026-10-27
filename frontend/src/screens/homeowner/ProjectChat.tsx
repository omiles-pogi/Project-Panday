import { useEffect, useRef, useState, type ComponentRef } from "react";
import {
  Text,
  View,
  TextInput,
  Pressable,
  ScrollView,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { usePlan, type ApprovalStage } from "@/context/PlanContext";
import { useTheme } from "@/context/ThemeContext";
import type { ChatHistoryMessage } from "@/services/ai/client";
import type { ConstructionPlan } from "@/types/plan";
import { budgetCategoryMeta } from "@/utils/budgetCategories";
import { peso } from "@/utils/currency";
import { createProject } from "@/services/api/projects";
import Mascot from "@/components/Mascot";
import KeyboardView from "@/components/KeyboardView";

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
}

let uid = 100;
const nextId = () => ++uid;

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
function PlanCard({ plan, onNext }: { plan: ConstructionPlan; onNext: () => void }) {
  const { chrome } = useTheme();
  // Every item starts approved — tapping a tile disapproves it (and tapping again re-approves),
  // so "what's left to review" is whatever the homeowner has actively flagged, not everything.
  const [disapproved, setDisapproved] = useState<Record<string, boolean>>({});
  const buffer = plan.budget - plan.totalEstimate;
  const materialsTotal = plan.materials.reduce((s, m) => s + m.qty * m.unitPrice, 0);
  const phaseNames = plan.phases.map((p) => p.name);
  // Bounded summaries instead of joining a whole (potentially long) list into one line — the raw
  // join used to get cut off mid-word on narrow screens, which read as messy rather than organized.
  const phasesDetail =
    phaseNames.length > 2 ? `${phaseNames.slice(0, 2).join(", ")} +${phaseNames.length - 2} more` : phaseNames.join(", ");
  const items: { icon: IconName; title: string; value: string; detail: string; color: string }[] = [
    { icon: "calendar-outline", title: "Timeline", value: `${plan.timelineMonths} months`, detail: `${plan.phases.length} phases planned`, color: "#3b82f6" },
    { icon: "wallet-outline", title: "AI Budget Estimate", value: peso(plan.totalEstimate), detail: buffer >= 0 ? `Within budget · ${peso(buffer)} buffer` : `Over budget by ${peso(Math.abs(buffer))}`, color: "#f59e0b" },
    { icon: "layers-outline", title: "Key Materials", value: `${plan.materials.length} material types`, detail: `Est. ${peso(materialsTotal)} total`, color: "#10b981" },
    { icon: "home-outline", title: "Design", value: plan.designStyle, detail: `${plan.bedrooms}BR / ${plan.bathrooms}BA · ${plan.areaSqm} sqm`, color: "#8b5cf6" },
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
                <Text className="font-bold text-sm text-foreground" numberOfLines={1}>
                  {item.value}
                </Text>
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
function BudgetCard({ plan, onNext }: { plan: ConstructionPlan; onNext: () => void }) {
  const { chrome } = useTheme();
  const total = plan.budgetBreakdown.reduce((s, b) => s + b.amount, 0) || plan.totalEstimate;
  const buffer = plan.budget - plan.totalEstimate;

  return (
    <CardShell>
      <CardHeader>
        <SectionHeader icon="wallet-outline" title="Budget Breakdown" badge="AI Estimate" />
      </CardHeader>
      <View className="p-4">
        <View className="flex-row gap-2 mb-4">
          {[
            { label: "Your Budget", value: `₱${(plan.budget / 1000000).toFixed(2)}M`, color: chrome.mutedForeground },
            { label: "AI Estimate", value: `₱${(plan.totalEstimate / 1000000).toFixed(2)}M`, color: "#f59e0b" },
            { label: "Buffer", value: `${buffer >= 0 ? "₱" : "-₱"}${Math.abs(buffer / 1000).toFixed(0)}K`, color: buffer >= 0 ? "#10b981" : "#ef4444" },
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
        <View style={{ gap: 14 }} className="mb-4">
          {plan.budgetBreakdown.map(({ category, amount }, i) => {
            const pct = total ? (amount / total) * 100 : 0;
            const meta = budgetCategoryMeta(category);
            return (
              <View key={`${category}-${i}`}>
                <View className="flex-row items-start gap-2 mb-1.5">
                  <Ionicons name={meta.icon} size={15} color={meta.color} style={{ marginTop: 1 }} />
                  <View className="flex-1">
                    <Text className="text-xs font-semibold text-foreground" numberOfLines={2}>
                      {category}
                    </Text>
                    {meta.description ? (
                      <Text className="text-xs mt-0.5 text-muted-foreground" numberOfLines={1}>
                        {meta.description}
                      </Text>
                    ) : null}
                  </View>
                </View>
                <View className="h-1.5 rounded-full mb-1" style={{ backgroundColor: chrome.muted }}>
                  <View className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: meta.color }} />
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-xs text-muted-foreground">{pct.toFixed(1)}% of total</Text>
                  <Text className="text-xs font-semibold" style={{ color: meta.color }}>
                    {peso(amount)}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
        <View className="flex-row gap-2">
          <Pressable onPress={onNext} className="flex-1 py-2.5 rounded-xl items-center flex-row justify-center gap-1.5 bg-primary">
            <Ionicons name="checkmark" size={15} color="#0f1117" />
            <Text className="text-sm font-bold text-primary-foreground">Approve Budget · Next →</Text>
          </Pressable>
          <Pressable className="px-4 py-2.5 rounded-xl items-center bg-muted border border-border">
            <Text className="text-sm text-muted-foreground">Modify</Text>
          </Pressable>
        </View>
      </View>
    </CardShell>
  );
}

/* MATERIALS CARD */
function MaterialsCard({ plan, onNext }: { plan: ConstructionPlan; onNext: () => void }) {
  const { chrome } = useTheme();
  const [approved, setApproved] = useState<Record<number, boolean>>({});
  const total = plan.materials.reduce((s, m) => s + m.qty * m.unitPrice, 0);
  const allApproved = plan.materials.every((_, i) => approved[i]);

  return (
    <CardShell>
      <CardHeader>
        <SectionHeader icon="layers-outline" title="Material Estimates" badge="AI Generated" />
        <Text className="text-sm font-bold" style={{ color: "#f59e0b" }}>
          {peso(total)}
        </Text>
      </CardHeader>
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
            Prices are AI estimates. Actual costs may vary based on supplier and market conditions.
          </Text>
        </View>
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
              <Text className="text-sm font-bold text-primary-foreground">Finalize Project Plan →</Text>
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
            <Text className="font-bold text-base" style={{ color: "#f59e0b" }}>
              {peso(plan.totalEstimate)}
            </Text>
          </View>
          <View className="flex-1 p-3 rounded-xl items-center bg-muted">
            <Text className="text-xs mb-1 text-muted-foreground">Project Duration</Text>
            <Text className="font-bold text-base" style={{ color: "#3b82f6" }}>
              {plan.timelineMonths} months
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
  budget: (p) => `Budget breakdown ready. Your ₱${(p.budget / 1000000).toFixed(2)}M budget ${p.budget >= p.totalEstimate ? `comfortably covers the ₱${(p.totalEstimate / 1000000).toFixed(2)}M estimate` : `is below the ₱${(p.totalEstimate / 1000000).toFixed(2)}M estimate — you may want to adjust scope`}.`,
  materials: () => "Material estimates below, based on current market prices.",
  summary: (p) => `All sections approved. Your construction plan for ${p.projectTitle} is ready — next, find contractors who'll receive it.`,
};

const STAGE_ORDER: ResolvedStage[] = ["plan", "budget", "materials", "summary"];
const NEXT_LABEL: Record<ResolvedStage, string> = {
  plan: "Show me the detailed budget breakdown",
  budget: "Looks good, show me the material list",
  materials: "Everything looks great. Finalize my project plan.",
  summary: "",
};

function greeting(): ChatMessage {
  return {
    id: nextId(),
    role: "ai",
    text: 'Describe your project and I\'ll generate a complete construction plan — timeline, budget, and materials. You can also just ask me questions or chat anytime, even after your plan is ready.\n\nTry: "3-bedroom house in Quezon City, 120 sqm, ₱2.5M budget, modern design."',
  };
}

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
    return [greeting()];
  }
  const rebuilt: ChatMessage[] = [greeting()];
  history.forEach((m, i) => {
    const isLastAssistantTurn = m.role === "assistant" && i === history.length - 1;
    rebuilt.push({
      id: nextId(),
      role: m.role === "user" ? "user" : "ai",
      text: m.content,
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
}: {
  msg: ChatMessage;
  plan: ConstructionPlan | null;
  onQuickReply: (text: string) => void;
  onAdvance: () => void;
}) {
  return (
    <View className="flex-row gap-3 items-start mb-4">
      <Mascot size={44} mood={msg.typing ? "thinking" : "happy"} bob={msg.typing} />
      <View className="flex-1" style={{ gap: 8 }}>
        {msg.typing ? (
          <View className="rounded-2xl self-start bg-card border border-border">
            <Dots />
          </View>
        ) : (
          <View className="rounded-2xl px-4 py-3 self-start bg-card border border-border" style={{ maxWidth: "100%" }}>
            <Text className="text-sm leading-relaxed text-card-foreground">{msg.text}</Text>
          </View>
        )}
        {!msg.typing && plan && msg.card === "plan" && <PlanCard plan={plan} onNext={onAdvance} />}
        {!msg.typing && plan && msg.card === "budget" && <BudgetCard plan={plan} onNext={onAdvance} />}
        {!msg.typing && plan && msg.card === "materials" && <MaterialsCard plan={plan} onNext={onAdvance} />}
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
    <View className="flex-row justify-end mb-4">
      <View className="rounded-2xl px-4 py-3 bg-primary" style={{ maxWidth: "80%" }}>
        <Text className="text-sm leading-relaxed text-primary-foreground">{msg.text}</Text>
      </View>
    </View>
  );
}

export default function ProjectChat() {
  const { chrome } = useTheme();
  const { plan, messages: planMessages, approvalStage, setApprovalStage, ready, activeProjectKey, linkToProject, send } =
    usePlan();
  const [messages, setMessages] = useState<ChatMessage[]>(() => reconstructMessages(plan, planMessages, approvalStage));
  const [input, setInput] = useState("");
  const [stage, setStage] = useState<Stage>(() => approvalStage ?? (plan ? "plan" : "idle"));
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);

  // PlanContext's conversation loads from storage asynchronously (so it survives an app
  // restart, not just in-app navigation) and switches to a different project's own conversation
  // whenever one is selected elsewhere (e.g. the Dashboard's project tabs) — both land after this
  // component's own initial state is already computed, so this re-syncs whenever either happens,
  // instead of getting stuck showing a stale or empty conversation.
  useEffect(() => {
    if (!ready) return;
    // Resyncing local UI state from an external store (PlanContext's active conversation)
    // changing out from under this component — not a derived-state anti-pattern this rule
    // otherwise guards against.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMessages(reconstructMessages(plan, planMessages, approvalStage));
    setStage(approvalStage ?? (plan ? "plan" : "idle"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, activeProjectKey]);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const resolveTyping = (id: number, update: Partial<ChatMessage>) => {
    setMessages((p) => p.map((m) => (m.id === id ? { ...m, ...update, typing: false } : m)));
  };

  // Every message goes through here — the AI itself decides whether to just chat, ask a
  // clarifying question, or submit/update the plan, so there's one handler instead of three.
  const handleSend = async (text: string) => {
    if (!text.trim() || busy) return;
    const hadPlanBefore = !!plan;
    setMessages((p) => [...p, { id: nextId(), role: "user", text: text.trim() }]);
    setInput("");

    if (!hadPlanBefore) setStage("generating");
    setBusy(true);
    const typingId = nextId();
    setMessages((p) => [...p, { id: typingId, role: "ai", text: "", typing: true }]);

    // Fires live as a chat reply streams in — flips the dots off and appends text word-by-word,
    // like Claude/ChatGPT. Never fires for a plan/clarification (those stay as dots until done,
    // since there's no meaningful partial JSON to show).
    const onChunk = (partial: string) => {
      setMessages((p) => p.map((m) => (m.id === typingId ? { ...m, text: m.text + partial, typing: false } : m)));
    };

    try {
      const result = await send(text.trim(), onChunk);

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
        hadPlanBefore && (STAGE_ORDER as string[]).includes(stage) ? (stage as ResolvedStage) : "plan";
      resolveTyping(typingId, { text: STAGE_TEXT[cardStage](result.plan), card: cardStage });
      setStage(cardStage);
      setApprovalStage(cardStage);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      resolveTyping(typingId, { text: `Sorry: ${message}` });
      if (!hadPlanBefore) setStage("idle");
    } finally {
      setBusy(false);
    }
  };

  const advance = () => {
    if (!plan || busy) return;
    const currentIndex = STAGE_ORDER.indexOf(stage as ResolvedStage);
    const next = STAGE_ORDER[currentIndex + 1];
    if (!next) return;
    const label = NEXT_LABEL[stage as ResolvedStage];

    if (next === "summary") {
      createProject(plan)
        .then((created) => linkToProject(created.id))
        .catch((err) => {
          console.warn("Failed to save project to dashboard:", err);
        });
    }

    setMessages((p) => [...p, { id: nextId(), role: "user", text: label }]);
    setBusy(true);
    const typingId = nextId();
    setMessages((p) => [...p, { id: typingId, role: "ai", text: "", typing: true }]);
    setTimeout(() => {
      resolveTyping(typingId, { text: STAGE_TEXT[next](plan), card: next });
      setStage(next);
      setApprovalStage(next);
      setBusy(false);
    }, 650);
  };

  const handleQuickReply = (text: string) => {
    if (stage === "idle") handleSend(text);
  };

  const showSuggestions = messages.length <= 1;

  return (
    <KeyboardView>
      <ScrollView ref={scrollRef} className="flex-1 px-4 py-5" contentContainerStyle={{ paddingBottom: 8 }}>
        {showSuggestions && (
          <View className="items-center mb-5">
            <Mascot size={110} />
            <Text className="text-lg font-extrabold text-foreground mt-2">Hi, I&apos;m Pandy!</Text>
            <Text className="text-xs text-muted-foreground mt-0.5">Your AI construction buddy</Text>
          </View>
        )}
        {messages.map((msg) =>
          msg.role === "ai" ? (
            <AIBubble key={msg.id} msg={msg} plan={plan} onQuickReply={handleQuickReply} onAdvance={advance} />
          ) : (
            <UserBubble key={msg.id} msg={msg} />
          )
        )}
      </ScrollView>

      <View className="px-4 pb-4">
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
            editable={!busy}
            className="flex-1 text-sm text-foreground"
            style={{ minHeight: 24, maxHeight: 120 }}
          />
          <Pressable
            onPress={() => handleSend(input)}
            disabled={!input.trim() || busy}
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
    </KeyboardView>
  );
}
