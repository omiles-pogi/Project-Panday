import { useEffect, useRef, useState } from "react";
import {
  Text,
  View,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { usePlan } from "@/context/PlanContext";
import type { ConstructionPlan } from "@/types/plan";
import { colorFor } from "@/utils/colors";
import { peso } from "@/utils/currency";
import { createProject } from "@/services/api/projects";

type IconName = keyof typeof Ionicons.glyphMap;

type MsgRole = "user" | "ai";
type CardType = "plan" | "budget" | "materials" | "equipment" | "design" | "summary";

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
  return (
    <View className="px-4 py-3 border-b flex-row items-center justify-between" style={{ borderColor: "#2a2f42", backgroundColor: "#252a3a" }}>
      {children}
    </View>
  );
}

/* PLAN OVERVIEW CARD */
function PlanCard({ plan, onNext }: { plan: ConstructionPlan; onNext: () => void }) {
  const [approved, setApproved] = useState<Record<string, boolean>>({});
  const buffer = plan.budget - plan.totalEstimate;
  const items: { icon: IconName; title: string; value: string; detail: string; color: string }[] = [
    { icon: "calendar-outline", title: "Timeline", value: `${plan.timelineMonths} months`, detail: `${plan.phases.length} phases`, color: "#3b82f6" },
    { icon: "wallet-outline", title: "AI Budget Estimate", value: peso(plan.totalEstimate), detail: buffer >= 0 ? `Within budget · ${peso(buffer)} buffer` : `Over budget by ${peso(Math.abs(buffer))}`, color: "#f59e0b" },
    { icon: "layers-outline", title: "Key Materials", value: `${plan.materials.length} material types`, detail: plan.materials.slice(0, 3).map((m) => m.material).join(", "), color: "#10b981" },
    { icon: "home-outline", title: "Design", value: plan.designStyle, detail: `${plan.bedrooms}BR / ${plan.bathrooms}BA · ${plan.areaSqm} sqm`, color: "#8b5cf6" },
    { icon: "construct-outline", title: "Equipment", value: `${plan.equipment.length} equipment types`, detail: plan.equipment.slice(0, 3).map((e) => e.name).join(", "), color: "#f43f5e" },
    { icon: "git-branch-outline", title: "Phases", value: `${plan.phases.length} phases`, detail: plan.phases.map((p) => p.name).join(" → "), color: "#06b6d4" },
  ];
  const allApproved = items.every((i) => approved[i.title]);

  return (
    <CardShell>
      <CardHeader>
        <SectionHeader icon="sparkles-outline" title="Construction Plan Overview" badge="AI Generated" />
      </CardHeader>
      <View className="p-4 flex-row flex-wrap gap-2">
        {items.map((item) => (
          <View
            key={item.title}
            className="rounded-xl p-3 flex-row items-start gap-2.5"
            style={{
              width: "47%",
              backgroundColor: approved[item.title] ? `${item.color}12` : "#252a3a",
              borderWidth: 1,
              borderColor: approved[item.title] ? `${item.color}50` : "transparent",
            }}
          >
            <Ionicons name={item.icon} size={18} color={item.color} />
            <View className="flex-1">
              <Text className="text-xs font-semibold mb-0.5" style={{ color: item.color }}>
                {item.title.toUpperCase()}
              </Text>
              <Text className="font-bold text-sm text-foreground">{item.value}</Text>
              <Text className="text-xs mt-0.5 text-muted-foreground" numberOfLines={1}>
                {item.detail}
              </Text>
            </View>
          </View>
        ))}
      </View>
      <View className="px-4 pb-4 flex-row gap-2">
        {allApproved ? (
          <Pressable onPress={onNext} className="flex-1 py-2.5 rounded-xl items-center bg-primary">
            <Text className="text-sm font-bold text-primary-foreground">Continue to Budget Breakdown →</Text>
          </Pressable>
        ) : (
          <>
            <Pressable
              onPress={() => setApproved(Object.fromEntries(items.map((i) => [i.title, true])))}
              className="flex-1 py-2 rounded-xl items-center flex-row justify-center gap-1.5 bg-primary"
            >
              <Ionicons name="checkmark" size={15} color="#0f1117" />
              <Text className="text-sm font-semibold text-primary-foreground">Approve All</Text>
            </Pressable>
            {items
              .filter((i) => !approved[i.title])
              .slice(0, 1)
              .map((i) => (
                <Pressable
                  key={i.title}
                  onPress={() => setApproved((p) => ({ ...p, [i.title]: true }))}
                  className="flex-1 py-2 rounded-xl items-center bg-muted border border-border"
                >
                  <Text className="text-sm text-muted-foreground">Approve One by One</Text>
                </Pressable>
              ))}
          </>
        )}
      </View>
    </CardShell>
  );
}

/* BUDGET CARD */
function BudgetCard({ plan, onNext }: { plan: ConstructionPlan; onNext: () => void }) {
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
            { label: "Your Budget", value: `₱${(plan.budget / 1000000).toFixed(2)}M`, color: "#9ca3af" },
            { label: "AI Estimate", value: `₱${(plan.totalEstimate / 1000000).toFixed(2)}M`, color: "#f59e0b" },
            { label: "Buffer", value: `${buffer >= 0 ? "₱" : "-₱"}${Math.abs(buffer / 1000).toFixed(0)}K`, color: buffer >= 0 ? "#10b981" : "#ef4444" },
          ].map(({ label, value, color }) => (
            <View key={label} className="flex-1 p-3 rounded-xl items-center bg-muted">
              <Text className="text-xs mb-1 text-muted-foreground">{label}</Text>
              <Text className="font-bold text-sm" style={{ color }}>
                {value}
              </Text>
            </View>
          ))}
        </View>
        <View style={{ gap: 8 }} className="mb-4">
          {plan.budgetBreakdown.map(({ category, amount }, i) => {
            const pct = total ? (amount / total) * 100 : 0;
            const color = colorFor(i);
            return (
              <View key={category}>
                <View className="flex-row justify-between mb-1">
                  <View className="flex-row items-center gap-1.5">
                    <View className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                    <Text className="text-xs text-muted-foreground">{category}</Text>
                  </View>
                  <View className="flex-row gap-3">
                    <Text className="text-xs text-muted-foreground">{pct.toFixed(1)}%</Text>
                    <Text className="text-xs font-medium text-foreground">{peso(amount)}</Text>
                  </View>
                </View>
                <View className="h-1.5 rounded-full" style={{ backgroundColor: "#2a2f42" }}>
                  <View className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
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
              style={{ borderColor: "#1e2235" }}
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
                style={{ backgroundColor: approved[i] ? "#10b98120" : "#252a3a" }}
              >
                {approved[i] ? (
                  <Ionicons name="checkmark" size={13} color="#10b981" />
                ) : (
                  <Text className="text-xs font-medium" style={{ color: "#9ca3af" }}>
                    OK
                  </Text>
                )}
              </Pressable>
            </View>
          ))}
        </ScrollView>
      </View>
      <View className="p-4 border-t" style={{ borderColor: "#2a2f42" }}>
        <View className="flex-row gap-1.5 mb-3">
          <Ionicons name="warning-outline" size={13} color="#6b7280" style={{ marginTop: 1 }} />
          <Text className="text-xs flex-1 text-muted-foreground">
            Prices are AI estimates. Actual costs may vary based on supplier and market conditions.
          </Text>
        </View>
        <View className="flex-row gap-2">
          <Pressable
            onPress={() => setApproved(Object.fromEntries(plan.materials.map((_, i) => [i, true])))}
            className="flex-1 py-2.5 rounded-xl items-center flex-row justify-center gap-1.5"
            style={{ backgroundColor: allApproved ? "#252a3a" : "#f59e0b15", borderWidth: 1, borderColor: "#f59e0b30" }}
          >
            <Ionicons name="checkmark" size={15} color={allApproved ? "#9ca3af" : "#f59e0b"} />
            <Text className="text-sm font-semibold" style={{ color: allApproved ? "#9ca3af" : "#f59e0b" }}>
              {allApproved ? "All Approved" : "Approve All Materials"}
            </Text>
          </Pressable>
          {allApproved && (
            <Pressable onPress={onNext} className="flex-1 py-2.5 rounded-xl items-center bg-primary">
              <Text className="text-sm font-bold text-primary-foreground">Next: Equipment →</Text>
            </Pressable>
          )}
        </View>
      </View>
    </CardShell>
  );
}

/* EQUIPMENT CARD */
function EquipmentCard({ plan, onNext }: { plan: ConstructionPlan; onNext: () => void }) {
  const [approved, setApproved] = useState(false);
  const total = plan.equipment.reduce((s, e) => s + e.cost, 0);

  return (
    <CardShell>
      <CardHeader>
        <SectionHeader icon="construct-outline" title="Equipment Requirements" badge="AI Generated" />
        <Text className="text-sm font-bold" style={{ color: "#f59e0b" }}>
          {peso(total)}
        </Text>
      </CardHeader>
      <View className="px-4 py-3" style={{ maxHeight: 240 }}>
        <ScrollView style={{ gap: 6 }}>
          {plan.equipment.map((e, i) => (
            <View key={i} className="flex-row items-center gap-3 px-3 py-2.5 rounded-xl mb-1.5 bg-muted">
              <Ionicons name="hammer-outline" size={16} color="#9ca3af" />
              <View className="flex-1">
                <Text className="text-xs font-medium text-foreground">{e.name}</Text>
                <Text className="text-xs text-muted-foreground">
                  {e.phase} · {e.duration}
                </Text>
              </View>
              <View className="items-end">
                <Text className="text-xs font-semibold" style={{ color: "#f59e0b" }}>
                  {peso(e.cost)}
                </Text>
                <Text className="text-xs text-muted-foreground">×{e.qty}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
      <View className="p-4 border-t" style={{ borderColor: "#2a2f42" }}>
        <View className="flex-row gap-2">
          <Pressable
            onPress={() => setApproved(true)}
            className="flex-1 py-2.5 rounded-xl items-center flex-row justify-center gap-1.5"
            style={{ backgroundColor: approved ? "#10b98120" : "#f59e0b15", borderWidth: 1, borderColor: approved ? "#10b98130" : "#f59e0b30" }}
          >
            <Ionicons name="checkmark" size={15} color={approved ? "#10b981" : "#f59e0b"} />
            <Text className="text-sm font-semibold" style={{ color: approved ? "#10b981" : "#f59e0b" }}>
              {approved ? "Equipment Approved" : "Approve Equipment"}
            </Text>
          </Pressable>
          {approved && (
            <Pressable onPress={onNext} className="flex-1 py-2.5 rounded-xl items-center bg-primary">
              <Text className="text-sm font-bold text-primary-foreground">Next: Design →</Text>
            </Pressable>
          )}
        </View>
      </View>
    </CardShell>
  );
}

/* DESIGN CARD */
function DesignCard({ plan, onNext }: { plan: ConstructionPlan; onNext: () => void }) {
  const [approved, setApproved] = useState(false);
  const rows = [
    { label: "Exterior", value: plan.exteriorConcept },
    { label: "Interior", value: plan.interiorConcept },
    { label: "Floor Area", value: `${plan.areaSqm} sqm · ${plan.floors} floor${plan.floors > 1 ? "s" : ""} · ${plan.bedrooms}BR / ${plan.bathrooms} bath` },
    { label: "Design Style", value: plan.designStyle },
  ];

  return (
    <CardShell>
      <CardHeader>
        <SectionHeader icon="color-palette-outline" title="AI Conceptual Design" badge="AI Generated" />
        {approved && (
          <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: "#10b98120" }}>
            <Text className="text-xs font-semibold" style={{ color: "#10b981" }}>
              Approved
            </Text>
          </View>
        )}
      </CardHeader>
      <View className="p-4">
        <View className="flex-row flex-wrap gap-2 mb-4">
          {rows.map(({ label, value }) => (
            <View key={label} className="px-3 py-2 rounded-lg bg-muted" style={{ width: "47%" }}>
              <Text className="text-xs mb-0.5 text-muted-foreground">{label}</Text>
              <Text className="text-xs font-medium text-foreground">{value}</Text>
            </View>
          ))}
        </View>
        <Text className="text-xs mb-4 text-muted-foreground">
          Detailed floor-plan rendering isn’t wired to an image model yet — a schematic isn’t shown on mobile.
        </Text>
        <View className="flex-row gap-2">
          <Pressable
            onPress={() => setApproved(true)}
            className="flex-1 py-2.5 rounded-xl items-center flex-row justify-center gap-1.5"
            style={{ backgroundColor: approved ? "#10b98120" : "#f59e0b15", borderWidth: 1, borderColor: approved ? "#10b98130" : "#f59e0b30" }}
          >
            {approved && <Ionicons name="checkmark" size={15} color="#10b981" />}
            <Text className="text-sm font-semibold" style={{ color: approved ? "#10b981" : "#f59e0b" }}>
              {approved ? "Design Approved" : "Approve Design"}
            </Text>
          </Pressable>
          {approved && (
            <Pressable onPress={onNext} className="flex-1 py-2.5 rounded-xl items-center bg-primary">
              <Text className="text-sm font-bold text-primary-foreground">Finalize →</Text>
            </Pressable>
          )}
        </View>
      </View>
    </CardShell>
  );
}

/* SUMMARY CARD */
function SummaryCard({ plan }: { plan: ConstructionPlan }) {
  return (
    <View className="rounded-2xl overflow-hidden" style={{ backgroundColor: "#1e2235", borderWidth: 1, borderColor: "#10b98140" }}>
      <View className="px-4 py-3 border-b flex-row items-center gap-2" style={{ borderColor: "#10b98130", backgroundColor: "#10b98112" }}>
        <Ionicons name="trophy-outline" size={18} color="#10b981" />
        <Text className="font-bold text-sm" style={{ color: "#10b981" }}>
          Project Plan Complete
        </Text>
      </View>
      <View className="p-4">
        <View style={{ gap: 8 }} className="mb-4">
          {["Construction Plan", "Budget Breakdown", "Material Estimates", "Equipment Plan", "Conceptual Design"].map((label) => (
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

const SUGGESTIONS = [
  "3-bedroom house, 120 sqm, modern design, Quezon City, ₱2.5M budget",
  "Two-story commercial building, 200 sqm, Makati, ₱5M budget",
  "Apartment renovation, 80 sqm, Pasig City, ₱800K budget",
  "Restaurant build-out, 60 sqm, BGC, ₱1.2M budget",
];

type Stage = "idle" | "generating" | "plan" | "budget" | "materials" | "equipment" | "design" | "summary";
type ResolvedStage = Exclude<Stage, "idle" | "generating">;

const STAGE_TEXT: Record<ResolvedStage, (p: ConstructionPlan) => string> = {
  plan: (p) => `Here's a complete overview of your construction plan for ${p.projectTitle}. Approve all sections or review them individually.`,
  budget: (p) => `Your AI budget breakdown is ready. Your ₱${(p.budget / 1000000).toFixed(2)}M budget ${p.budget >= p.totalEstimate ? `comfortably covers the estimated ₱${(p.totalEstimate / 1000000).toFixed(2)}M cost` : `is below the estimated ₱${(p.totalEstimate / 1000000).toFixed(2)}M cost — you may want to adjust scope`}.`,
  materials: () => "Here are the AI-estimated material requirements. Prices are based on current market data — review and approve each item.",
  equipment: () => "Here's the recommended equipment list with estimated rental/usage costs per construction phase.",
  design: (p) => `Here's your AI-generated conceptual design concept for a ${p.designStyle.toLowerCase()} ${p.bedrooms}-bedroom, ${p.bathrooms}-bathroom home.`,
  summary: (p) => `All sections are approved! 🎉 Your complete construction plan for ${p.projectTitle} is ready. You can now search for contractors who will receive your approved plan.`,
};

const STAGE_ORDER: ResolvedStage[] = ["plan", "budget", "materials", "equipment", "design", "summary"];
const NEXT_LABEL: Record<ResolvedStage, string> = {
  plan: "Show me the detailed budget breakdown",
  budget: "Looks good, show me the material list",
  materials: "Great, show me the equipment needed",
  equipment: "Now show me the AI conceptual design",
  design: "Everything looks great. Finalize my project plan.",
  summary: "",
};

function greeting(): ChatMessage {
  return {
    id: nextId(),
    role: "ai",
    text: 'Hello! I\'m your AI Construction Planner. Describe your project and I\'ll generate a complete plan — timeline, budget, materials, equipment, and conceptual design — all in one conversation.\n\nYou can type naturally, like: "3-bedroom house in Quezon City, 120 sqm, ₱2.5M budget, modern design."',
    quickReplies: ["Residential house", "Renovation project", "Commercial building", "Two-story apartment"],
  };
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
      <View className="w-8 h-8 rounded-lg items-center justify-center" style={{ backgroundColor: "#f59e0b20" }}>
        <Ionicons name="sparkles-outline" size={16} color="#f59e0b" />
      </View>
      <View className="flex-1" style={{ gap: 8 }}>
        {msg.typing ? (
          <View className="rounded-2xl self-start bg-card border border-border">
            <Dots />
          </View>
        ) : (
          <View className="rounded-2xl px-4 py-3 self-start bg-card border border-border" style={{ maxWidth: "100%" }}>
            <Text className="text-sm leading-relaxed" style={{ color: "#e8eaed" }}>
              {msg.text}
            </Text>
          </View>
        )}
        {!msg.typing && plan && msg.card === "plan" && <PlanCard plan={plan} onNext={onAdvance} />}
        {!msg.typing && plan && msg.card === "budget" && <BudgetCard plan={plan} onNext={onAdvance} />}
        {!msg.typing && plan && msg.card === "materials" && <MaterialsCard plan={plan} onNext={onAdvance} />}
        {!msg.typing && plan && msg.card === "equipment" && <EquipmentCard plan={plan} onNext={onAdvance} />}
        {!msg.typing && plan && msg.card === "design" && <DesignCard plan={plan} onNext={onAdvance} />}
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
  const { plan, generate } = usePlan();
  const [messages, setMessages] = useState<ChatMessage[]>([greeting()]);
  const [input, setInput] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const resolveTyping = (id: number, update: Partial<ChatMessage>) => {
    setMessages((p) => p.map((m) => (m.id === id ? { ...m, ...update, typing: false } : m)));
  };

  const startGeneration = async (brief: string) => {
    if (!brief.trim() || busy) return;
    setMessages((p) => [...p, { id: nextId(), role: "user", text: brief.trim() }]);
    setInput("");

    setStage("generating");
    setBusy(true);
    const typingId = nextId();
    setMessages((p) => [...p, { id: typingId, role: "ai", text: "", typing: true }]);

    try {
      const result = await generate(brief.trim());
      resolveTyping(typingId, {
        text: `I've processed your requirements. Here's your full AI construction plan for ${result.projectTitle}. Review and approve each section — only approved items will be shared with contractors.`,
      });
      setMessages((p) => [...p, { id: nextId(), role: "ai", text: STAGE_TEXT.plan(result), card: "plan" }]);
      setStage("plan");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong generating your plan.";
      resolveTyping(typingId, { text: `Sorry, I couldn't generate a plan: ${message}` });
      setStage("idle");
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
      createProject(plan).catch((err) => {
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
      setBusy(false);
    }, 650);
  };

  const handleQuickReply = (text: string) => {
    if (stage === "idle") startGeneration(text);
  };

  const showSuggestions = messages.length <= 1;

  return (
    <KeyboardAvoidingView className="flex-1 bg-background" behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView ref={scrollRef} className="flex-1 px-4 py-5" contentContainerStyle={{ paddingBottom: 8 }}>
        {messages.map((msg) =>
          msg.role === "ai" ? (
            <AIBubble key={msg.id} msg={msg} plan={plan} onQuickReply={handleQuickReply} onAdvance={advance} />
          ) : (
            <UserBubble key={msg.id} msg={msg} />
          )
        )}
      </ScrollView>

      {showSuggestions && (
        <View className="px-4 pb-3">
          <Text className="text-xs mb-2 text-muted-foreground">Quick start:</Text>
          <View className="flex-row flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <Pressable
                key={s}
                onPress={() => startGeneration(s)}
                disabled={busy}
                className="px-3 py-2.5 rounded-xl bg-card border border-border"
                style={{ width: "47%" }}
              >
                <Text className="text-xs text-muted-foreground">{s}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <View className="px-4 pb-4">
        <View className="flex-row gap-3 items-end rounded-2xl p-3 bg-card border border-border">
          <TextInput
            value={input}
            onChangeText={setInput}
            multiline
            placeholder={busy ? "AI is generating your plan..." : "Describe your project or ask a question..."}
            placeholderTextColor="#6b7280"
            editable={!busy}
            className="flex-1 text-sm text-foreground"
            style={{ minHeight: 24, maxHeight: 120 }}
          />
          <Pressable
            onPress={() => startGeneration(input)}
            disabled={!input.trim() || busy}
            className="w-9 h-9 rounded-xl items-center justify-center"
            style={{ backgroundColor: input.trim() && !busy ? "#f59e0b" : "#252a3a" }}
          >
            <Ionicons name="arrow-up" size={18} color={input.trim() && !busy ? "#0f1117" : "#6b7280"} />
          </Pressable>
        </View>
        <Text className="text-xs text-center mt-2" style={{ color: "#3a3f52" }}>
          AI recommends · You decide · All items require your approval
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}
