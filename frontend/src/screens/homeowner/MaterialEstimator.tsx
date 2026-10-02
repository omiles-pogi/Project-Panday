import { useState } from "react";
import { ScrollView, Text, TextInput, View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usePlan } from "@/context/PlanContext";
import BriefPrompt from "@/components/BriefPrompt";

const CATEGORY_COLORS: Record<string, string> = {
  Concrete: "#f59e0b",
  Structural: "#3b82f6",
  Aggregate: "#10b981",
  Carpentry: "#8b5cf6",
  Masonry: "#f43f5e",
  Roofing: "#06b6d4",
  Electrical: "#fbbf24",
  Plumbing: "#34d399",
  Finishing: "#a78bfa",
};
const FALLBACK_COLOR = "#6b7280";

export default function MaterialEstimator() {
  const { plan, brief, loading, error, generate } = usePlan();
  const [search, setSearch] = useState("");
  const [approved, setApproved] = useState<Record<number, boolean>>({});

  if (!plan) {
    return (
      <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 16 }}>
        <Badge />
        <Text className="text-2xl font-bold mt-2 mb-1 text-foreground">Material Estimator</Text>
        <View className="mt-4">
          <BriefPrompt onGenerate={generate} loading={loading} error={error} />
        </View>
      </ScrollView>
    );
  }

  const materials = plan.materials;
  const filtered = materials
    .map((m, i) => ({ ...m, idx: i }))
    .filter(
      (m) =>
        m.material.toLowerCase().includes(search.toLowerCase()) ||
        m.category.toLowerCase().includes(search.toLowerCase())
    );
  const total = materials.reduce((sum, m) => sum + m.qty * m.unitPrice, 0);
  const approvedCount = Object.values(approved).filter(Boolean).length;

  return (
    <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
      <Badge />
      <View className="flex-row items-center justify-between mt-2 mb-4">
        <View>
          <Text className="text-2xl font-bold mb-0.5 text-foreground">Material Estimator</Text>
          <Text className="text-sm text-muted-foreground">{plan.projectTitle}</Text>
        </View>
        <Pressable
          onPress={() => brief && generate(brief)}
          disabled={loading}
          className="px-3 py-2 rounded-xl bg-primary flex-row items-center gap-1.5"
          style={{ opacity: loading ? 0.6 : 1 }}
        >
          <Ionicons name="refresh" size={14} color="#0f1117" />
          <Text className="text-sm font-semibold text-primary-foreground">{loading ? "Regenerating…" : "Regenerate"}</Text>
        </Pressable>
      </View>

      <View className="rounded-xl px-4 py-3 mb-4 flex-row gap-2" style={{ backgroundColor: "#f59e0b15", borderWidth: 1, borderColor: "#f59e0b30" }}>
        <Ionicons name="warning-outline" size={16} color="#fbbf24" />
        <Text className="text-xs leading-relaxed flex-1" style={{ color: "#fbbf24" }}>
          AI-estimated prices. Final prices depend on supplier negotiations and market conditions.
        </Text>
      </View>

      <View className="rounded-xl px-4 py-3 mb-4 flex-row items-center gap-2 bg-card border border-border">
        <Ionicons name="search-outline" size={16} color="#6b7280" />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search materials…"
          placeholderTextColor="#6b7280"
          className="flex-1 text-sm text-foreground"
        />
        <Text className="text-xs font-bold" style={{ color: "#f59e0b" }}>
          ₱{(total / 1000000).toFixed(2)}M
        </Text>
      </View>

      <View style={{ gap: 8 }} className="mb-4">
        {filtered.map((m) => {
          const lineTotal = m.qty * m.unitPrice;
          const catColor = CATEGORY_COLORS[m.category] || FALLBACK_COLOR;
          const isApproved = !!approved[m.idx];
          return (
            <View key={m.idx} className="rounded-xl px-4 py-3 bg-card border border-border">
              <View className="flex-row items-start justify-between gap-2 mb-1.5">
                <View className="flex-1">
                  <Text className="font-semibold text-sm text-foreground">{m.material}</Text>
                  <View
                    className="self-start px-1.5 py-0.5 rounded mt-1"
                    style={{ backgroundColor: `${catColor}20` }}
                  >
                    <Text className="text-xs font-medium" style={{ color: catColor }}>
                      {m.category}
                    </Text>
                  </View>
                </View>
                <View className="items-end">
                  <Text className="font-bold text-sm" style={{ color: "#f59e0b" }}>
                    ₱{lineTotal.toLocaleString()}
                  </Text>
                  <Text className="text-xs text-muted-foreground">
                    {m.qty.toLocaleString()} {m.unit} × ₱{m.unitPrice.toLocaleString()}
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={() => setApproved((p) => ({ ...p, [m.idx]: !p[m.idx] }))}
                className="self-start px-3 py-1 rounded-lg flex-row items-center gap-1"
                style={{ backgroundColor: isApproved ? "#10b98120" : "#252a3a" }}
              >
                {isApproved && <Ionicons name="checkmark-circle" size={13} color="#10b981" />}
                <Text className="text-xs font-medium" style={{ color: isApproved ? "#10b981" : "#9ca3af" }}>
                  {isApproved ? "Approved" : "Approve"}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>

      <View className="flex-row justify-between items-center px-1 py-2">
        <Text className="text-xs text-muted-foreground">
          {filtered.length} items · {approvedCount} approved
        </Text>
        <Text className="font-bold text-sm" style={{ color: "#f59e0b" }}>
          Total: ₱{total.toLocaleString()}
        </Text>
      </View>
    </ScrollView>
  );
}

function Badge() {
  return (
    <View
      className="self-start px-2 py-0.5 rounded-full flex-row items-center gap-1"
      style={{ backgroundColor: "#f59e0b20" }}
    >
      <Ionicons name="sparkles-outline" size={11} color="#f59e0b" />
      <Text className="text-xs font-semibold" style={{ color: "#f59e0b" }}>
        AI GENERATED
      </Text>
    </View>
  );
}
