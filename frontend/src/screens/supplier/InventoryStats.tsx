import { StatGrid, StatTile } from "@/components/ui";
import { STOCK_COLORS } from "@/components/StockBadge";
import type { Product } from "@/data/supplier";

/** Total / In Stock / Out of Stock tiles — shared by the supplier Dashboard and Inventory screen. */
export default function InventoryStats({ products, onPress }: { products: Product[]; onPress?: () => void }) {
  const inStock = products.filter((p) => p.stockStatus === "in_stock").length;
  return (
    <StatGrid>
      <StatTile label="Listed Materials" value={products.length} color="#8b5cf6" icon="layers-outline" onPress={onPress} />
      <StatTile label="In Stock" value={inStock} color={STOCK_COLORS.in_stock} icon="checkmark-circle-outline" onPress={onPress} />
      <StatTile
        label="Out of Stock"
        value={products.length - inStock}
        color={STOCK_COLORS.out_of_stock}
        icon="close-circle-outline"
        onPress={onPress}
      />
    </StatGrid>
  );
}
