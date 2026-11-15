import { useRef, useState } from "react";
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
import { useConfirmDialog } from "@/components/ConfirmDialog";
import { fetchStockConfirmationReview, type StockConfirmationReview } from "@/services/api/supplierProducts";
import { isSupplierStockConfirmed } from "@/utils/supplierStock";

const STOCK_FILTERS = ["All", "In Stock", "Out of Stock"];
const WHOLE_NUMBER = /^\d+$/;

const errorMessage = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);

/** Supplier inventory management — the "Inventory" tab (route kept as /supplier/pricing). */
export default function Pricing() {
  const { products, productsLoading, productsError, reloadProducts, updateProduct, setAllProductsActive, confirmStock } = useSupplier();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [stockFilter, setStockFilter] = useState("All");
  const [editing, setEditing] = useState<Product | null>(null);
  const [restocking, setRestocking] = useState<Product | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [availabilityBusy, setAvailabilityBusy] = useState(false);
  const [availabilityMessage, setAvailabilityMessage] = useState<string | null>(null);
  const [stockReview, setStockReview] = useState<StockConfirmationReview | null>(null);
  const availabilityInFlight = useRef(false);
  const { ask, dialog } = useConfirmDialog();
  const eligible = (p: Product) => p.activationEligible ?? (p.price > 0 && p.availableQuantity > 0 && isSupplierStockConfirmed(p));
  const eligibleCount = products.filter((p) => !p.isActive && eligible(p)).length;
  const activeCount = products.filter((p) => p.isActive).length;
  const availableCount = products.filter((p) => p.isActive && eligible(p)).length;
  const unconfirmedCount = products.filter((p) => !isSupplierStockConfirmed(p)).length;

  // Dashboard and bottom navigation actions use ?add=1 to open the form; closing it
  // clears the param so returning to this (already-mounted) tab later doesn't reopen it.
  const { add } = useLocalSearchParams<{ add?: string }>();
  const adding = add === "1";
  const closeAdd = () => {
    if (add) router.setParams({ add: undefined });
  };

  const term = search.trim().toLowerCase();
  const shown = products.filter(
    (p) =>
      (category === "All" || p.category === category) &&
      (stockFilter === "All" || (stockFilter === "In Stock") === (p.stockStatus === "in_stock")) &&
      (!term || p.name.toLowerCase().includes(term))
  );

  const runAvailability = async (work: () => Promise<string>) => {
    if (availabilityInFlight.current) return;
    availabilityInFlight.current = true;
    setAvailabilityBusy(true);
    setToggleError(null);
    setAvailabilityMessage(null);
    try {
      setAvailabilityMessage(await work());
    } catch (err) {
      setToggleError(errorMessage(err, "Could not update availability. Please try again."));
    } finally {
      availabilityInFlight.current = false;
      setAvailabilityBusy(false);
    }
  };
  const bulk = (active: boolean) => {
    ask({ title: active ? "Activate All Materials?" : "Deactivate All Materials?",
      message: active ? "Activate all eligible materials in your inventory? These products will become available to homeowners and PandAI."
        : "Deactivate all active materials? They will no longer be available to homeowners and PandAI until reactivated.",
      detail: active ? `${eligibleCount} eligible inactive materials` : `${activeCount} active materials`,
      confirmLabel: active ? "Activate All" : "Deactivate All", mood: "thinking",
      onConfirm: () => { void runAvailability(async () => {
        const result = await setAllProductsActive(active);
        return `${result.updated} ${active ? "activated" : "deactivated"}; ${result.skipped} skipped; ${result.failed} failed.`;
      }); },
    });
  };
  const prepareStockReview = () => runAvailability(async () => {
    const review = await fetchStockConfirmationReview();
    setStockReview(review);
    // Also reconcile a previously lost confirmation response without writing any records.
    reloadProducts();
    return `Review ${review.count} recorded quantities before confirming physical stock.`;
  });
  const confirmReviewedStock = () => {
    if (!stockReview) return;
    void runAvailability(async () => {
      const result = await confirmStock(stockReview.review_token);
      setStockReview(null);
      return `${result.updated} products' stock confirmed; ${result.skipped} already confirmed. Activation flags unchanged. Use Activate All for inactive eligible materials.`;
    });
  };
  const toggleActive = (p: Product) => {
    if (!p.isActive && !eligible(p)) {
      setToggleError(p.activationBlockReason ?? "Confirm available stock and a valid price before activation.");
      return;
    }
    ask({ title: p.isActive ? "Deactivate Material?" : "Activate Material?", detail: p.name,
      message: p.isActive ? "This material will no longer be available to homeowners and PandAI. Its saved records and stock will be preserved."
        : "Make this eligible material available to homeowners and PandAI?",
      confirmLabel: p.isActive ? "Deactivate" : "Activate", mood: "thinking",
      onConfirm: () => { void runAvailability(async () => {
        await updateProduct(p.id, { isActive: !p.isActive });
        return `${p.name} ${p.isActive ? "deactivated" : "activated"}.`;
      }); },
    });
  };

  return (
    <Screen>
      <PageHeader title="Inventory" subtitle="Manage your materials, prices and stock levels." badge="Supplier" />

      <InventoryStats products={products} />

      <View style={{ gap: 8 }}>
        <Pressable accessibilityRole="button" disabled={availabilityBusy || productsLoading || products.length === 0}
          onPress={() => { void prepareStockReview(); }} className="py-3 px-3 rounded-xl items-center bg-muted border border-border"
          style={{ opacity: availabilityBusy || productsLoading || products.length === 0 ? 0.5 : 1 }}>
          <Text className="text-xs font-bold text-foreground">Confirm Stock for All</Text>
        </Pressable>
        <View className="flex-row gap-3">
          {[{ label: "Activate All", active: true }, { label: "Deactivate All", active: false }].map((action) => (
            <Pressable key={action.label} accessibilityRole="button" disabled={availabilityBusy || productsLoading || products.length === 0}
              onPress={() => bulk(action.active)} className="flex-1 min-w-0 py-3 px-2 rounded-xl items-center bg-primary"
              style={{ opacity: availabilityBusy || productsLoading || products.length === 0 ? 0.5 : 1 }}>
              <Text numberOfLines={1} adjustsFontSizeToFit className="text-xs font-bold text-primary-foreground">{action.label}</Text>
            </Pressable>
          ))}
        </View>
        <Text className="text-xs text-muted-foreground">{availableCount} active / in stock · {products.length - activeCount} inactive · {eligibleCount} eligible for activation</Text>
        {unconfirmedCount > 0 && <Text className="text-xs text-muted-foreground">{unconfirmedCount} materials have unconfirmed stock and are excluded from stock-status totals.</Text>}
        {availabilityBusy && <Text className="text-xs text-muted-foreground">Updating availability…</Text>}
        {availabilityMessage && <Text accessibilityRole="alert" className="text-xs" style={{ color: "#10b981" }}>{availabilityMessage}</Text>}
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
            No materials listed yet. Tap “Add Product” in the bottom navigation to list your first item.
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
            availabilityBusy={availabilityBusy}
          />
        ))
      )}

      {editing && <MaterialFormSheet key={`edit-${editing.id}`} product={editing} onClose={() => setEditing(null)} />}
      {adding && <MaterialFormSheet onClose={closeAdd} />}
      {restocking && <StockSheet key={`stock-${restocking.id}`} product={restocking} onClose={() => setRestocking(null)} />}
      {stockReview && <Sheet visible title="Confirm Stock for All?" subtitle={`${stockReview.count} recorded quantities to verify`}
        onClose={() => { if (!availabilityBusy) setStockReview(null); }}>
        <Text className="text-sm text-foreground">Confirm only after you have physically verified every recorded quantity below. This records your verification; it does not change quantities, prices, descriptions, or activation flags.</Text>
        {stockReview.products.some((p) => p.is_active) && <Text className="text-xs text-muted-foreground">Already-active listings may become available once their stock is verified and all eligibility requirements are met. Inactive listings stay inactive.</Text>}
        {stockReview.products.map((p) => <View key={p.id} className="p-3 rounded-xl bg-muted" style={{ gap: 4 }}>
          <Text className="text-sm font-semibold text-foreground">#{p.id} · {p.name}</Text>
          <Text className="text-xs text-secondary-foreground">Recorded quantity: {p.stock} {p.unit} · Reserved: {p.reserved} · {p.is_active ? "Active" : "Inactive"}</Text>
        </View>)}
        {stockReview.count === 0 && <Text className="text-xs text-muted-foreground">All current products already have a recorded stock confirmation.</Text>}
        {toggleError && <Text className="text-xs text-danger">{toggleError}</Text>}
        <View className="flex-row gap-3">
          <Pressable accessibilityRole="button" disabled={availabilityBusy} onPress={() => setStockReview(null)} className="flex-1 py-3 rounded-xl items-center bg-muted">
            <Text className="text-xs font-semibold text-foreground">Cancel</Text>
          </Pressable>
          <Pressable accessibilityRole="button" disabled={availabilityBusy || stockReview.count === 0} onPress={confirmReviewedStock}
            className="flex-1 py-3 px-2 rounded-xl items-center bg-primary" style={{ opacity: availabilityBusy || stockReview.count === 0 ? 0.5 : 1 }}>
            <Text className="text-xs font-bold text-primary-foreground">{availabilityBusy ? "Confirming…" : "I verified these quantities"}</Text>
          </Pressable>
        </View>
        <Pressable accessibilityRole="button" disabled={availabilityBusy} onPress={() => { void prepareStockReview(); }} className="py-2 items-center">
          <Text className="text-xs font-semibold text-primary">Refresh Review</Text>
        </Pressable>
      </Sheet>}
      {dialog}
    </Screen>
  );
}

function InventoryCard({
  product: p,
  onEdit,
  onRestock,
  onToggleActive,
  availabilityBusy,
}: {
  product: Product;
  onEdit: () => void;
  onRestock: () => void;
  onToggleActive: () => void;
  availabilityBusy: boolean;
}) {
  const { chrome } = useTheme();
  const unconfirmed = !isSupplierStockConfirmed(p);
  const available = p.isActive && p.availableQuantity > 0 && p.price > 0 && !unconfirmed && p.activationEligible !== false;
  return (
    <Card gap={10}>
      <View className="flex-row justify-between items-start gap-3" style={{ opacity: p.isActive ? 1 : 0.6 }}>
        <View className="flex-1 gap-1.5">
          <Text className="text-sm font-bold text-foreground">{p.name}</Text>
          <View className="flex-row flex-wrap gap-2 items-center">
            <Badge label={p.category} color={CAT_COLORS[p.category] ?? CAT_COLORS.Other} />
            {unconfirmed ? <Badge label="Stock unconfirmed" color="#f59e0b" /> : <StockBadge status={p.stockStatus} />}
            <Badge label={!p.isActive ? "Inactive" : available ? "Active / In Stock" : "Unavailable"} color={available ? "#10b981" : "#6b7280"} />
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
        {unconfirmed ? "Unconfirmed quantity: " : "Available: "}<Text className="font-semibold text-foreground">{p.availableQuantity.toLocaleString()} {p.unit}</Text>
        {p.reserved > 0 ? ` · On hand ${p.stock.toLocaleString()} · Reserved ${p.reserved.toLocaleString()}` : ""} · Min order {p.minOrder}
      </Text>
      {p.activationBlockReason && <Text className="text-xs text-muted-foreground">{p.activationBlockReason}</Text>}
      {p.stockConfirmedAt && p.stockConfirmed && <Text className="text-xs text-muted-foreground">Stock verified {new Date(p.stockConfirmedAt).toLocaleString()} · {p.stockConfirmedQuantity} {p.unit}. Original product notes retained.</Text>}

      <View pointerEvents={availabilityBusy ? "none" : "auto"} style={{ opacity: availabilityBusy ? 0.5 : 1 }} className="flex-row flex-wrap gap-2">
        <Button label="Update Stock" variant="tint" color="#10b981" onPress={onRestock} />
        <Button label="Edit" variant="tint" color="#f59e0b" onPress={onEdit} />
        <Pressable disabled={availabilityBusy} onPress={onToggleActive} className="px-4 py-2.5 rounded-xl items-center" style={{ backgroundColor: chrome.muted, opacity: availabilityBusy ? 0.5 : 1 }}>
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

    const input: Omit<ProductInput, "isActive"> = {
      name: name.trim(),
      category,
      description: description.trim(),
      unit: unit.trim(),
      price: Number(price),
      stock: Number(stock),
      minOrder: Number(minOrder),
    };

    setSaving(true);
    setError(null);
    try {
      if (product) await updateProduct(product.id, input);
      else await addProduct({ ...input, isActive: true });
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
