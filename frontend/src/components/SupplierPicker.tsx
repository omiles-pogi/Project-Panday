import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Sheet from "@/components/Sheet";
import { useTheme } from "@/context/ThemeContext";
import { fetchSupplierOptions } from "@/services/ai/client";
import {
  SUPPLIER_CATEGORIES,
  type ConstructionPlan,
  type SupplierCategory,
  type SupplierCategoryOptions,
  type SupplierOption,
  type SupplierSelections,
} from "@/types/plan";

type IconName = keyof typeof Ionicons.glyphMap;

const CATEGORY_META: Record<SupplierCategory, { icon: IconName; color: string }> = {
  "Construction Materials": { icon: "construct-outline", color: "#3b82f6" },
  "Electrical and Plumbing": { icon: "flash-outline", color: "#fbbf24" },
  "Finishing Works": { icon: "color-palette-outline", color: "#a78bfa" },
};

/** What the homeowner has chosen so far, with every category present (null = best price). */
export function selectionsOf(plan: ConstructionPlan): SupplierSelections {
  return {
    "Construction Materials": plan.supplierSelections?.["Construction Materials"] ?? null,
    "Electrical and Plumbing": plan.supplierSelections?.["Electrical and Plumbing"] ?? null,
    "Finishing Works": plan.supplierSelections?.["Finishing Works"] ?? null,
  };
}

/**
 * Lets the homeowner pick which supplier the plan's prices come from, per category — construction
 * materials, electrical and plumbing, finishing works. Choosing one asks the AI to re-source that
 * category's materials from that supplier's real listings (onChoose); "best price" lets it pick the
 * cheapest in-stock listing across suppliers.
 */
export default function SupplierPicker({
  plan,
  onChoose,
  disabled,
}: {
  plan: ConstructionPlan;
  onChoose: (category: SupplierCategory, supplier: SupplierOption | null) => void;
  disabled?: boolean;
}) {
  const { chrome } = useTheme();
  const [options, setOptions] = useState<SupplierCategoryOptions[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState<SupplierCategory | null>(null);
  const selections = selectionsOf(plan);

  useEffect(() => {
    let cancelled = false;
    fetchSupplierOptions()
      .then((data) => {
        if (!cancelled) setOptions(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't load suppliers.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const suppliersFor = (category: SupplierCategory) => options?.find((o) => o.category === category)?.suppliers ?? [];
  const chosenName = (category: SupplierCategory) => {
    const id = selections[category];
    if (id === null) return null;
    return (
      suppliersFor(category).find((s) => s.id === id)?.name ??
      plan.materials.find((m) => m.supplierId === id)?.supplierName ??
      "Chosen supplier"
    );
  };

  const pickerSuppliers = picking ? suppliersFor(picking) : [];

  return (
    <View style={{ gap: 8 }}>
      <View className="flex-row items-center gap-1.5">
        <Ionicons name="storefront-outline" size={14} color="#f59e0b" />
        <Text className="text-xs font-bold text-foreground">Choose your suppliers</Text>
      </View>
      <Text className="text-xs text-muted-foreground">
        Prices come from the real listings of the supplier you pick for each category.
      </Text>

      {!options && !error && <ActivityIndicator color="#f59e0b" style={{ marginVertical: 6 }} />}
      {error && <Text className="text-xs text-danger">{error}</Text>}

      {options &&
        SUPPLIER_CATEGORIES.map((category) => {
          const meta = CATEGORY_META[category];
          const name = chosenName(category);
          const available = suppliersFor(category).length;
          return (
            <Pressable
              key={category}
              disabled={disabled || available === 0}
              onPress={() => setPicking(category)}
              className="flex-row items-center gap-2.5 px-3 py-2.5 rounded-xl border"
              style={{ backgroundColor: chrome.muted, borderColor: chrome.border, opacity: disabled ? 0.6 : 1 }}
              accessibilityLabel={`${category} supplier: ${name ?? "best price"}. Tap to change.`}
            >
              <Ionicons name={meta.icon} size={18} color={meta.color} />
              <View className="flex-1">
                <Text className="text-xs font-semibold text-foreground">{category}</Text>
                <Text className="text-xs" style={{ color: name ? "#10b981" : chrome.mutedForeground }} numberOfLines={1}>
                  {available === 0 ? "No supplier has listed items yet — AI estimate" : (name ?? "Best price from any supplier")}
                </Text>
              </View>
              {available > 0 && <Text className="text-xs font-semibold" style={{ color: "#f59e0b" }}>Change</Text>}
            </Pressable>
          );
        })}

      <Sheet
        visible={picking !== null}
        title={picking ?? "Supplier"}
        subtitle="Pick who supplies this category. The AI will re-price it from their listings."
        onClose={() => setPicking(null)}
      >
        {picking && (
          <>
            <SupplierRow
              label="Best price from any supplier"
              sub="The cheapest in-stock listing for each item"
              selected={selections[picking] === null}
              onPress={() => {
                onChoose(picking, null);
                setPicking(null);
              }}
            />
            {pickerSuppliers.map((s) => (
              <SupplierRow
                key={s.id}
                label={s.name}
                sub={`${s.inStockCount} in stock · ${s.itemCount} listed`}
                selected={selections[picking] === s.id}
                onPress={() => {
                  onChoose(picking, s);
                  setPicking(null);
                }}
              />
            ))}
          </>
        )}
      </Sheet>
    </View>
  );
}

function SupplierRow({
  label,
  sub,
  selected,
  onPress,
}: {
  label: string;
  sub: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { chrome } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 px-4 py-3 rounded-2xl border"
      style={{ backgroundColor: selected ? "#f59e0b15" : chrome.muted, borderColor: selected ? "#f59e0b" : chrome.border }}
    >
      <View className="flex-1">
        <Text className="text-sm font-semibold text-foreground">{label}</Text>
        <Text className="text-xs text-muted-foreground">{sub}</Text>
      </View>
      {selected && <Ionicons name="checkmark-circle" size={20} color="#f59e0b" />}
    </Pressable>
  );
}
