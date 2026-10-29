import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Badge, Button, Card, ChipPicker, Field, MONO, PageHeader, Screen } from "@/components/ui";
import Sheet from "@/components/Sheet";
import StockBadge from "@/components/StockBadge";
import { useTheme } from "@/context/ThemeContext";
import { CATEGORIES, CAT_COLORS, type StockStatus } from "@/data/supplier";
import { fetchMaterialCatalog, type CatalogMaterialDto } from "@/services/api/supplierProducts";
import { peso } from "@/utils/currency";

const STOCK_FILTERS: Record<string, StockStatus | undefined> = {
  All: undefined,
  "In Stock": "in_stock",
  "Out of Stock": "out_of_stock",
};
const SEARCH_DEBOUNCE_MS = 300;

const supplierLabel = (m: CatalogMaterialDto) => m.supplier.business_name || m.supplier.name;

/** Read-only catalog of every supplier's active listings, for homeowners and contractors.
 * `topInset` is false where the route already has a navigation header (contractor stack). */
export default function MaterialCatalog({ topInset = true }: { topInset?: boolean }) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [stockFilter, setStockFilter] = useState("All");
  const [materials, setMaterials] = useState<CatalogMaterialDto[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CatalogMaterialDto | null>(null);
  // Responses can arrive out of order while typing — only the newest request may update the list.
  const requestId = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(() => {
    const id = ++requestId.current;
    setLoading(true);
    fetchMaterialCatalog({
      search: debouncedSearch,
      category: category === "All" ? undefined : category,
      stock: STOCK_FILTERS[stockFilter],
    })
      .then((list) => {
        if (id !== requestId.current) return;
        setMaterials(list);
        setError(null);
      })
      .catch((err) => {
        if (id !== requestId.current) return;
        setError(err instanceof Error ? err.message : "Failed to load materials.");
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
  }, [debouncedSearch, category, stockFilter]);

  // Re-fetches on every focus too, so a supplier's stock change shows up when coming back here.
  useFocusEffect(load);

  const hasFilters = !!debouncedSearch.trim() || category !== "All" || stockFilter !== "All";

  return (
    <Screen topInset={topInset}>
      <PageHeader title="Material Catalog" subtitle="Browse supplier materials, prices and stock availability." />

      <Field label="Search" value={search} onChangeText={setSearch} placeholder="Search materials by name" maxLength={100} />
      <ChipPicker label="Category" options={["All", ...CATEGORIES]} value={category} onChange={setCategory} />
      <ChipPicker label="Availability" options={Object.keys(STOCK_FILTERS)} value={stockFilter} onChange={setStockFilter} />

      {error ? (
        <Card gap={10}>
          <Text className="text-xs text-danger">{error}</Text>
          <View className="flex-row">
            <Button label="Try Again" variant="muted" onPress={load} />
          </View>
        </Card>
      ) : materials === null ? (
        <View className="items-center py-10">
          <ActivityIndicator color="#f59e0b" />
        </View>
      ) : (
        <>
          <View className="flex-row items-center justify-between">
            <Text className="text-xs text-muted-foreground">
              {materials.length} material{materials.length === 1 ? "" : "s"}
            </Text>
            {loading && <ActivityIndicator size="small" color="#f59e0b" />}
          </View>
          {materials.length === 0 ? (
            <Card>
              <Text className="text-sm text-center text-muted-foreground py-6">
                {hasFilters ? "No materials match your search or filters." : "No suppliers have listed materials yet."}
              </Text>
            </Card>
          ) : (
            materials.map((m) => <MaterialCard key={m.id} material={m} onPress={() => setSelected(m)} />)
          )}
        </>
      )}

      {selected && <MaterialDetailSheet material={selected} onClose={() => setSelected(null)} />}
    </Screen>
  );
}

function MaterialCard({ material: m, onPress }: { material: CatalogMaterialDto; onPress: () => void }) {
  const { chrome } = useTheme();
  const inStock = m.stock_status === "in_stock";
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${m.name}, ${inStock ? "in stock" : "out of stock"}`}>
      <Card gap={8}>
        <View className="flex-row justify-between items-start gap-3" style={{ opacity: inStock ? 1 : 0.75 }}>
          <View className="flex-1 gap-1.5">
            <Text className="text-sm font-bold text-foreground">{m.name}</Text>
            <View className="flex-row flex-wrap gap-2 items-center">
              <Badge label={m.category} color={CAT_COLORS[m.category] ?? CAT_COLORS.Other} />
              <StockBadge status={m.stock_status} quantity={m.available_quantity} unit={m.unit} />
            </View>
          </View>
          <View className="items-end">
            <Text className="text-base font-bold text-primary" style={{ fontFamily: MONO }}>
              {peso(m.price)}
            </Text>
            <Text className="text-xs text-muted-foreground">per {m.unit}</Text>
          </View>
        </View>
        <View className="flex-row items-center gap-1.5">
          <Ionicons name="storefront-outline" size={13} color={chrome.mutedForeground} />
          <Text className="flex-1 text-xs text-muted-foreground" numberOfLines={1}>
            {supplierLabel(m)}
          </Text>
          <Text className="text-xs font-medium text-primary">Details</Text>
        </View>
        {!inStock && <Text className="text-xs text-danger">Currently unavailable from this supplier.</Text>}
      </Card>
    </Pressable>
  );
}

function MaterialDetailSheet({ material: m, onClose }: { material: CatalogMaterialDto; onClose: () => void }) {
  const inStock = m.stock_status === "in_stock";
  const rows: [string, string][] = [
    ["Price", `${peso(m.price)} per ${m.unit}`],
    ["Available quantity", inStock ? `${m.available_quantity.toLocaleString()} ${m.unit}` : "None — out of stock"],
    ["Minimum order", `${m.min_order.toLocaleString()} ${m.unit}`],
    ["Supplier", supplierLabel(m)],
    ...(m.supplier.business_name ? ([["Contact person", m.supplier.name]] as [string, string][]) : []),
  ];

  return (
    <Sheet visible title={m.name} subtitle={m.category} onClose={onClose}>
      <StockBadge status={m.stock_status} quantity={m.available_quantity} unit={m.unit} />
      {m.description ? <Text className="text-sm leading-5 text-secondary-foreground">{m.description}</Text> : null}
      <View className="rounded-xl bg-muted p-3" style={{ gap: 8 }}>
        {rows.map(([label, value]) => (
          <View key={label} className="flex-row justify-between gap-3">
            <Text className="text-xs text-muted-foreground">{label}</Text>
            <Text className="flex-1 text-right text-xs font-semibold text-foreground">{value}</Text>
          </View>
        ))}
      </View>
      {!inStock && (
        <Text className="text-xs text-danger">
          This supplier has no stock right now. Check back later or look for the same material from another supplier.
        </Text>
      )}
      <Text className="text-xs text-muted-foreground">Updated {new Date(m.updated_at).toLocaleDateString()}</Text>
    </Sheet>
  );
}
