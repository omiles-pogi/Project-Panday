import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Badge, Button, Card, ChipPicker, Field, MONO, PageHeader, Screen, SubmitButton } from "@/components/ui";
import Sheet from "@/components/Sheet";
import StockBadge from "@/components/StockBadge";
import { useSupplier } from "@/context/SupplierContext";
import { useTheme } from "@/context/ThemeContext";
import { CATEGORIES, CAT_COLORS, UNITS, type Product, type ProductInput } from "@/data/supplier";
import { peso } from "@/utils/currency";
import InventoryStats from "./InventoryStats";

const STOCK_FILTERS = ["All", "In Stock", "Out of Stock"];
const WHOLE_NUMBER = /^\d+$/;

const errorMessage = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);

/** Supplier inventory management — the "Inventory" tab (route kept as /supplier/pricing). */
export default function Pricing() {
  const { products, productsLoading, productsError, reloadProducts, updateProduct } = useSupplier();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [stockFilter, setStockFilter] = useState("All");
  const [editing, setEditing] = useState<Product | null>(null);
  const [restocking, setRestocking] = useState<Product | null>(null);
  const [addingManually, setAddingManually] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);

  // The Dashboard's "+ Add Material" lands here with ?add=1, which opens the form; closing it
  // clears the param so returning to this (already-mounted) tab later doesn't reopen it.
  const { add } = useLocalSearchParams<{ add?: string }>();
  const adding = addingManually || add === "1";
  const closeAdd = () => {
    setAddingManually(false);
    if (add) router.setParams({ add: undefined });
  };

  const term = search.trim().toLowerCase();
  const shown = products.filter(
    (p) =>
      (category === "All" || p.category === category) &&
      (stockFilter === "All" || (stockFilter === "In Stock") === (p.stockStatus === "in_stock")) &&
      (!term || p.name.toLowerCase().includes(term))
  );

  const toggleActive = (p: Product) => {
    setToggleError(null);
    updateProduct(p.id, { isActive: !p.isActive }).catch((err) => setToggleError(errorMessage(err, "Could not update listing.")));
  };

  return (
    <Screen>
      <PageHeader title="Inventory" subtitle="Manage your materials, prices and stock levels." badge="Supplier" />

      <InventoryStats products={products} />

      <View className="flex-row">
        <Button label="+ Add Material" onPress={() => setAddingManually(true)} />
      </View>

      <Field label="Search" value={search} onChangeText={setSearch} placeholder="Search your materials by name" />
      <ChipPicker label="Category" options={["All", ...CATEGORIES]} value={category} onChange={setCategory} />
      <ChipPicker label="Stock" options={STOCK_FILTERS} value={stockFilter} onChange={setStockFilter} />

      {toggleError && <Text className="text-xs text-danger">{toggleError}</Text>}

      {productsLoading && products.length === 0 ? (
        <View className="items-center py-10">
          <ActivityIndicator color="#f59e0b" />
        </View>
      ) : productsError && products.length === 0 ? (
        <Card gap={10}>
          <Text className="text-xs text-danger">{productsError}</Text>
          <View className="flex-row">
            <Button label="Try Again" variant="muted" onPress={reloadProducts} />
          </View>
        </Card>
      ) : products.length === 0 ? (
        <Card>
          <Text className="text-sm text-center text-muted-foreground py-6">
            No materials listed yet. Tap “+ Add Material” to list your first item.
          </Text>
        </Card>
      ) : shown.length === 0 ? (
        <Text className="text-sm text-center text-muted-foreground py-6">No materials match these filters.</Text>
      ) : (
        shown.map((p) => (
          <InventoryCard
            key={p.id}
            product={p}
            onEdit={() => setEditing(p)}
            onRestock={() => setRestocking(p)}
            onToggleActive={() => toggleActive(p)}
          />
        ))
      )}

      {editing && <MaterialFormSheet key={`edit-${editing.id}`} product={editing} onClose={() => setEditing(null)} />}
      {adding && <MaterialFormSheet onClose={closeAdd} />}
      {restocking && <StockSheet key={`stock-${restocking.id}`} product={restocking} onClose={() => setRestocking(null)} />}
    </Screen>
  );
}

function InventoryCard({
  product: p,
  onEdit,
  onRestock,
  onToggleActive,
}: {
  product: Product;
  onEdit: () => void;
  onRestock: () => void;
  onToggleActive: () => void;
}) {
  const { chrome } = useTheme();
  return (
    <Card gap={10}>
      <View className="flex-row justify-between items-start gap-3" style={{ opacity: p.isActive ? 1 : 0.6 }}>
        <View className="flex-1 gap-1.5">
          <Text className="text-sm font-bold text-foreground">{p.name}</Text>
          <View className="flex-row flex-wrap gap-2 items-center">
            <Badge label={p.category} color={CAT_COLORS[p.category] ?? CAT_COLORS.Other} />
            <StockBadge status={p.stockStatus} />
            {!p.isActive && <Badge label="Hidden" color="#6b7280" />}
          </View>
          {p.description ? (
            <Text className="text-xs text-muted-foreground" numberOfLines={2}>
              {p.description}
            </Text>
          ) : null}
        </View>
        <View className="items-end">
          <Text className="text-base font-bold text-primary" style={{ fontFamily: MONO }}>
            {peso(p.price)}
          </Text>
          <Text className="text-xs text-muted-foreground">per {p.unit}</Text>
        </View>
      </View>

      <Text className="text-xs text-muted-foreground">
        Available: <Text className="font-semibold text-foreground">{p.availableQuantity.toLocaleString()} {p.unit}</Text>
        {p.reserved > 0 ? ` · On hand ${p.stock.toLocaleString()} · Reserved ${p.reserved.toLocaleString()}` : ""} · Min order {p.minOrder}
      </Text>

      <View className="flex-row flex-wrap gap-2">
        <Button label="Update Stock" variant="tint" color="#10b981" onPress={onRestock} />
        <Button label="Edit" variant="tint" color="#f59e0b" onPress={onEdit} />
        <Pressable onPress={onToggleActive} className="px-4 py-2.5 rounded-xl items-center" style={{ backgroundColor: chrome.muted }}>
          <Text className="text-xs font-semibold" style={{ color: chrome.mutedForeground }}>
            {p.isActive ? "Deactivate" : "Activate"}
          </Text>
        </Pressable>
      </View>
    </Card>
  );
}

/** Add (no `product`) or edit (with `product`) every detail of a listing; edit mode can also delete. */
function MaterialFormSheet({ product, onClose }: { product?: Product; onClose: () => void }) {
  const { addProduct, updateProduct, removeProduct } = useSupplier();
  const [name, setName] = useState(product?.name ?? "");
  const [category, setCategory] = useState(product?.category ?? CATEGORIES[0]);
  const [description, setDescription] = useState(product?.description ?? "");
  const [unit, setUnit] = useState(product?.unit ?? "");
  const [price, setPrice] = useState(product ? String(product.price) : "");
  const [stock, setStock] = useState(product ? String(product.stock) : "");
  const [minOrder, setMinOrder] = useState(product ? String(product.minOrder) : "1");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const unitOptions = unit && !UNITS.includes(unit) ? [...UNITS, unit] : UNITS;
  const categoryOptions = product && !CATEGORIES.includes(product.category) ? [...CATEGORIES, product.category] : CATEGORIES;

  const save = async () => {
    if (saving) return;
    if (!name.trim()) return setError("Enter a material name.");
    if (!unit.trim()) return setError("Choose or type a unit of measurement.");
    if (!WHOLE_NUMBER.test(price.trim()) || Number(price) < 1) return setError("Enter a price of at least ₱1 (whole pesos).");
    if (!WHOLE_NUMBER.test(stock.trim())) return setError("Enter the available quantity (0 or more).");
    if (!WHOLE_NUMBER.test(minOrder.trim()) || Number(minOrder) < 1) return setError("Minimum order must be at least 1.");

    const input: ProductInput = {
      name: name.trim(),
      category,
      description: description.trim(),
      unit: unit.trim(),
      price: Number(price),
      stock: Number(stock),
      minOrder: Number(minOrder),
      isActive: product?.isActive ?? true,
    };

    setSaving(true);
    setError(null);
    try {
      if (product) await updateProduct(product.id, input);
      else await addProduct(input);
      onClose();
    } catch (err) {
      setError(errorMessage(err, "Could not save this material."));
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!product || saving) return;
    if (!confirmDelete) return setConfirmDelete(true);
    setSaving(true);
    try {
      await removeProduct(product.id);
      onClose();
    } catch (err) {
      setError(errorMessage(err, "Could not delete this material."));
      setSaving(false);
    }
  };

  return (
    <Sheet
      visible
      title={product ? "Edit Material" : "Add Material"}
      subtitle={product ? product.name : "List a new construction material."}
      onClose={onClose}
    >
      <Field label="Material name *" value={name} onChangeText={setName} placeholder="e.g. Portland Cement Type I" maxLength={150} />
      <ChipPicker label="Category *" options={categoryOptions} value={category} onChange={setCategory} />
      <Field
        label="Description"
        value={description}
        onChangeText={setDescription}
        placeholder="Grade, size, brand, delivery notes…"
        multiline
        maxLength={1000}
      />
      <ChipPicker label="Unit of measurement *" options={unitOptions} value={unit} onChange={setUnit} />
      <Field label="…or type a unit" value={unit} onChangeText={setUnit} placeholder="e.g. pail" autoCapitalize="none" maxLength={30} />
      <Field label={`Price (₱ per ${unit || "unit"}) *`} value={price} onChangeText={setPrice} keyboardType="number-pad" />
      <Field label="Available quantity *" value={stock} onChangeText={setStock} keyboardType="number-pad" />
      <Field label="Minimum order" value={minOrder} onChangeText={setMinOrder} keyboardType="number-pad" />

      {WHOLE_NUMBER.test(stock.trim()) && (
        <View className="flex-row items-center gap-2">
          <Text className="text-xs text-muted-foreground">Will show as</Text>
          <StockBadge status={Number(stock) > 0 ? "in_stock" : "out_of_stock"} />
        </View>
      )}

      {error && <Text className="text-xs text-danger">{error}</Text>}
      <SubmitButton label={saving ? "Saving…" : product ? "Save Changes" : "Add Material"} onPress={save} />

      {product && (
        <Pressable onPress={remove} className="flex-row items-center justify-center gap-2 py-3">
          <Ionicons name="trash-outline" size={16} color="#ef4444" />
          <Text className="text-sm font-semibold text-danger">{confirmDelete ? "Tap again to permanently delete" : "Delete Material"}</Text>
        </Pressable>
      )}
    </Sheet>
  );
}

/** Quick quantity update — status follows automatically (0 → Out of Stock, > 0 → In Stock). */
function StockSheet({ product, onClose }: { product: Product; onClose: () => void }) {
  const { updateProduct } = useSupplier();
  const [stock, setStock] = useState(String(product.stock));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const valid = WHOLE_NUMBER.test(stock.trim());
  const qty = valid ? Number(stock) : null;
  const adjust = (delta: number) => setStock(String(Math.max(0, (qty ?? product.stock) + delta)));

  const save = async (value = qty) => {
    if (saving) return;
    if (value === null) return setError("Enter a whole number, 0 or more.");
    setSaving(true);
    setError(null);
    try {
      await updateProduct(product.id, { stock: value });
      onClose();
    } catch (err) {
      setError(errorMessage(err, "Could not update stock."));
      setSaving(false);
    }
  };

  return (
    <Sheet visible title="Update Stock" subtitle={product.name} onClose={onClose}>
      <View className="p-3 rounded-xl bg-muted flex-row justify-between items-center">
        <Text className="text-xs text-muted-foreground">
          Current: {product.stock.toLocaleString()} {product.unit}
        </Text>
        <StockBadge status={product.stockStatus} />
      </View>

      <Field label={`New available quantity (${product.unit})`} value={stock} onChangeText={setStock} keyboardType="number-pad" />

      <View className="flex-row flex-wrap gap-2">
        {[-10, -1, 1, 10, 100].map((d) => (
          <Button key={d} label={d > 0 ? `+${d}` : String(d)} variant="muted" onPress={() => adjust(d)} />
        ))}
      </View>

      {qty !== null && (
        <View className="flex-row items-center gap-2">
          <Text className="text-xs text-muted-foreground">Will show as</Text>
          <StockBadge status={qty > 0 ? "in_stock" : "out_of_stock"} />
        </View>
      )}

      {error && <Text className="text-xs text-danger">{error}</Text>}
      <SubmitButton label={saving ? "Saving…" : "Save Quantity"} onPress={() => save()} />
      {product.stock > 0 && (
        <Pressable onPress={() => save(0)} className="items-center py-2">
          <Text className="text-sm font-semibold text-danger">Mark as Out of Stock</Text>
        </Pressable>
      )}
    </Sheet>
  );
}
