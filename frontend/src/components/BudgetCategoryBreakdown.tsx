import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CountUp } from "@/components/charts";
import { ProgressBar } from "@/components/ui";
import { budgetCategoryMeta } from "@/utils/budgetCategories";
import { peso } from "@/utils/currency";
import { wageLine } from "@/utils/wage";
import type { BudgetLine, MaterialLine } from "@/types/plan";
import type { DashboardProject } from "@/types/project";

// The catalog taxonomy, matching SupplierProduct::PLAN_CATEGORIES. Do not guess from item names.
const MATERIAL_CATEGORIES: Record<string, string[]> = {
  "Construction Materials": ["Cement", "Sand", "Gravel", "Aggregate", "Steel", "Lumber", "Masonry", "Roofing", "Hardware"],
  "Electrical and Plumbing": ["Electrical", "Plumbing"],
  "Finishing Works": ["Paint", "Other"],
};

export default function BudgetCategoryBreakdown({
  breakdown,
  materials = [],
  project,
}: {
  breakdown: BudgetLine[];
  materials?: MaterialLine[];
  project?: DashboardProject;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const total = breakdown.reduce((sum, line) => sum + line.amount, 0);

  return (
    <View style={{ gap: 14 }}>
      <Text className="text-xs text-muted-foreground">Tap a category to view its details.</Text>
      {breakdown.map(({ category, amount }, index) => {
        const key = `${category}-${index}`;
        const open = expanded === key;
        const meta = budgetCategoryMeta(category);
        const pct = total > 0 ? (amount / total) * 100 : 0;
        const items = materials.filter((item) => item.category === category || MATERIAL_CATEGORIES[category]?.includes(item.category));
        const members = category === "Labor Costs" ? project?.workers : category === "Contractor and Project Management Fee" ? project?.contractors : undefined;
        const orders = project?.budgetRecords?.orderLines.filter((line) => line.category === category) ?? [];

        return (
          <View key={key}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${category}, ${peso(amount)} estimated. ${open ? "Hide" : "Show"} details`}
              accessibilityState={{ expanded: open }}
              onPress={() => setExpanded(open ? null : key)}
              className="py-2"
            >
              <View className="flex-row items-center gap-2 mb-2">
                <Ionicons name={meta.icon} size={16} color={meta.color} />
                <Text className="flex-1 text-xs font-semibold text-foreground">{category}</Text>
                <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={meta.color} />
              </View>
              <ProgressBar pct={pct} color={meta.color} height={6} />
              <View className="flex-row justify-between mt-1.5">
                <Text className="text-xs text-muted-foreground">{pct.toFixed(1)}% of estimate</Text>
                <CountUp text={peso(amount)} className="text-xs font-semibold" style={{ color: meta.color }} />
              </View>
            </Pressable>
            {open && (
              <View className="rounded-xl p-3 bg-muted border border-border" style={{ gap: 12 }}>
                <Text className="text-xs leading-5 text-muted-foreground">Category scope: {meta.description || category}</Text>
                <Text className="text-xs font-semibold text-foreground">Planned allocation: {peso(amount)} (estimate)</Text>
                <Text className="text-xs text-muted-foreground">
                  {project ? "From the approved plan saved for this project." : "From the current plan proposal. Save the approved plan to monitor it."}
                </Text>
                {items.length > 0 ? (
                  <View style={{ gap: 8 }}>
                    <Text className="text-xs font-bold text-foreground">Planned materials</Text>
                    {items.map((item, itemIndex) => (
                      <View key={`${item.material}-${itemIndex}`} style={{ gap: 2 }}>
                        <Text className="text-xs font-semibold text-foreground">{item.material}</Text>
                        <Text className="text-xs text-muted-foreground">{item.qty.toLocaleString()} {item.unit} × {peso(item.unitPrice)} = {peso(item.qty * item.unitPrice)}</Text>
                        <Text className="text-xs text-muted-foreground">
                          {item.supplierProductId && item.supplierName ? `Supplier price saved with plan · ${item.supplierName}` : "Estimated price · no verified supplier link"}
                        </Text>
                      </View>
                    ))}
                    <Text className="text-xs text-muted-foreground">Listed material subtotal: {peso(items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0))}. These items may cover only part of the category allocation.</Text>
                  </View>
                ) : (
                  <Text className="text-xs text-muted-foreground">No itemized material estimate is saved under this category.</Text>
                )}
                {members && (
                  <View style={{ gap: 8 }}>
                    <Text className="text-xs font-bold text-foreground">Assigned team · recorded wages</Text>
                    {members.length === 0 ? <Text className="text-xs text-muted-foreground">No team members assigned in this category.</Text> : members.map((member) => (
                      <View key={member.id}>
                        <Text className="text-xs font-semibold text-foreground">{member.name}</Text>
                        <Text className="text-xs text-muted-foreground">{wageLine(member.wage)}</Text>
                      </View>
                    ))}
                    <Text className="text-xs text-muted-foreground">Agreed total: {peso(members.reduce((sum, member) => sum + (member.wage && !member.wage.auto ? member.wage.total : 0), 0))}. Payment is not tracked.</Text>
                    {members.some((member) => member.wage?.auto) && <Text className="text-xs text-muted-foreground">Automatic wage estimates: {peso(members.reduce((sum, member) => sum + (member.wage?.auto ? member.wage.total : 0), 0))}. These have not been agreed by a person.</Text>}
                  </View>
                )}
                {project && !members && (
                  <View style={{ gap: 8 }}>
                    <Text className="text-xs font-bold text-foreground">Material fulfillment records</Text>
                    {orders.length === 0 ? <Text className="text-xs text-muted-foreground">No material fulfillments are recorded under this category.</Text> : orders.map((line) => (
                      <View key={line.id} style={{ gap: 2 }}>
                        <Text className="text-xs font-semibold text-foreground">Fulfillment #{line.orderId} · {line.material}</Text>
                        <Text className="text-xs text-muted-foreground">{line.qty} {line.unit} × {peso(line.unitPrice)} = {peso(line.total)}</Text>
                        <Text className="text-xs text-muted-foreground">{line.supplierName ?? "Supplier unavailable"} · {line.status.replaceAll("_", " ")}</Text>
                        <Text className="text-xs text-muted-foreground">{line.priceConfirmed ? "Supplier confirmed price" : "Request estimate"}{line.isCommitment ? " · committed fulfillment" : " · excluded from confirmed total"}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}
