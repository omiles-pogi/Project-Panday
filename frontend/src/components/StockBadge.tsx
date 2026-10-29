import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { StockStatus } from "@/data/supplier";

export const STOCK_COLORS: Record<StockStatus, string> = {
  in_stock: "#10b981",
  out_of_stock: "#ef4444",
};

/** Green "In Stock" / red "Out of Stock" pill, shared by the supplier inventory and the buyer
 * catalog so both always read the same backend-derived status the same way. */
export default function StockBadge({ status, quantity, unit }: { status: StockStatus; quantity?: number; unit?: string }) {
  const inStock = status === "in_stock";
  const color = STOCK_COLORS[status];
  return (
    <View
      className="self-start flex-row items-center gap-1 px-2 py-0.5 rounded-full"
      style={{ backgroundColor: `${color}20` }}
      accessibilityLabel={inStock ? "In stock" : "Out of stock"}
    >
      <Ionicons name={inStock ? "checkmark-circle" : "close-circle"} size={12} color={color} />
      <Text className="text-xs font-semibold" style={{ color }}>
        {inStock ? "In Stock" : "Out of Stock"}
        {inStock && quantity !== undefined ? ` · ${quantity.toLocaleString()}${unit ? ` ${unit}` : ""}` : ""}
      </Text>
    </View>
  );
}
