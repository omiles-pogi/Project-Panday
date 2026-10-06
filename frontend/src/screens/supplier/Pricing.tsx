import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Badge, Button, Card, ChipPicker, Field, MONO, PageHeader, Screen, SubmitButton } from "@/components/ui";
import Sheet from "@/components/Sheet";
import { useSupplier } from "@/context/SupplierContext";
import { CATEGORIES, CAT_COLORS, DEMAND_COLORS, TREND_ICON, type Product } from "@/data/supplier";
import { peso } from "@/utils/currency";

const LOW_STOCK = (p: Product) => p.stock <= p.minOrder * 4;

export default function Pricing() {
  const { products, updateProduct } = useSupplier();
  const [category, setCategory] = useState("All");
  const [editing, setEditing] = useState<Product | null>(null);
  const [adding, setAdding] = useState(false);

  const shown = category === "All" ? products : products.filter((p) => p.category === category);

  return (
    <Screen>
      <PageHeader title="Pricing & Stock" subtitle="Keep prices and availability up to date." badge="Supplier" />

      <View className="flex-row">
        <Button label="+ Add Product" onPress={() => setAdding(true)} />
      </View>

      <ChipPicker label="Category" options={["All", ...CATEGORIES]} value={category} onChange={setCategory} />

      {shown.map((p) => {
        const color = CAT_COLORS[p.category] ?? CAT_COLORS.Other;
        const trend = TREND_ICON[p.trend];
        return (
          <Card key={p.id} gap={10}>
            <View className="flex-row justify-between items-start gap-3">
              <View className="flex-1 gap-1.5">
                <Text className="text-sm font-bold text-foreground">{p.name}</Text>
                <View className="flex-row gap-2 items-center">
                  <Badge label={p.category} color={color} />
                  <Badge label={`${p.demand} demand`} color={DEMAND_COLORS[p.demand]} />
                  <Ionicons name={trend.icon} size={15} color={trend.color} />
                </View>
              </View>
              <View className="items-end">
                <Text className="text-base font-bold text-primary" style={{ fontFamily: MONO }}>
                  {peso(p.price)}
                </Text>
                <Text className="text-xs text-muted-foreground">per {p.unit}</Text>
              </View>
            </View>

            <View className="flex-row justify-between items-center">
              <View>
                <Text className="text-xs text-muted-foreground">
                  Stock {p.stock.toLocaleString()} {p.unit} · Min order {p.minOrder}
                </Text>
                {LOW_STOCK(p) && p.available && <Text className="text-xs mt-0.5 text-danger">Low stock</Text>}
              </View>
              <Pressable
                onPress={() => updateProduct(p.id, { available: !p.available })}
                className="px-3 py-1.5 rounded-full"
                style={{ backgroundColor: p.available ? "#10b98120" : "#252a3a" }}
              >
                <Text className="text-xs font-semibold" style={{ color: p.available ? "#10b981" : "#6b7280" }}>
                  {p.available ? "Available" : "Unavailable"}
                </Text>
              </Pressable>
            </View>

            <View className="flex-row">
              <Button label="Edit Price & Stock" variant="tint" color="#f59e0b" onPress={() => setEditing(p)} />
            </View>
          </Card>
        );
      })}

      {editing && <EditSheet key={editing.id} product={editing} onClose={() => setEditing(null)} />}
      {adding && <AddSheet onClose={() => setAdding(false)} />}
    </Screen>
  );
}

function EditSheet({ product, onClose }: { product: Product; onClose: () => void }) {
  const { updateProduct } = useSupplier();
  const [price, setPrice] = useState(String(product.price));
  const [stock, setStock] = useState(String(product.stock));
  const [minOrder, setMinOrder] = useState(String(product.minOrder));
  const [error, setError] = useState<string | null>(null);

  const diff = Number(price) - product.price;
  const changed = Number(price) > 0 && diff !== 0;

  const save = () => {
    if (!(Number(price) > 0)) return setError("Enter a valid price.");
    if (!(Number(stock) >= 0) || stock.trim() === "") return setError("Enter a valid stock amount.");
    updateProduct(product.id, { price: Number(price), stock: Number(stock), minOrder: Math.max(1, Number(minOrder) || 1) });
    onClose();
  };

  return (
    <Sheet visible title="Edit Product" subtitle={product.name} onClose={onClose}>
      <View className="p-3 rounded-xl bg-muted">
        <View className="flex-row justify-between">
          <Text className="text-xs text-muted-foreground">Current price</Text>
          <Text className="text-sm font-bold text-secondary-foreground" style={{ fontFamily: MONO }}>
            {peso(product.price)}/{product.unit}
          </Text>
        </View>
        {changed && (
          <View className="flex-row justify-between mt-1">
            <Text className="text-xs text-muted-foreground">Change</Text>
            <Text className="text-xs font-semibold" style={{ color: diff > 0 ? "#ef4444" : "#10b981", fontFamily: MONO }}>
              {diff > 0 ? "+" : "-"}
              {peso(Math.abs(diff))} ({((diff / product.price) * 100).toFixed(1)}%)
            </Text>
          </View>
        )}
      </View>

      <Field label={`New unit price (₱ per ${product.unit}) *`} value={price} onChangeText={setPrice} keyboardType="numeric" />
      <Field label={`Stock on hand (${product.unit}) *`} value={stock} onChangeText={setStock} keyboardType="numeric" />
      <Field label="Minimum order" value={minOrder} onChangeText={setMinOrder} keyboardType="numeric" />

      {error && <Text className="text-xs text-danger">{error}</Text>}
      <SubmitButton label="Save Changes" onPress={save} />
    </Sheet>
  );
}

function AddSheet({ onClose }: { onClose: () => void }) {
  const { addProduct } = useSupplier();
  const [name, setName] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [unit, setUnit] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [minOrder, setMinOrder] = useState("1");
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    if (!name.trim()) return setError("Enter a product name.");
    if (!unit.trim()) return setError("Enter a unit (e.g. bag, kg, pc).");
    if (!(Number(price) > 0)) return setError("Enter a valid price.");
    if (!(Number(stock) >= 0) || stock.trim() === "") return setError("Enter your current stock.");
    addProduct({
      name: name.trim(),
      category,
      unit: unit.trim(),
      price: Number(price),
      stock: Number(stock),
      minOrder: Math.max(1, Number(minOrder) || 1),
      available: true,
    });
    onClose();
  };

  return (
    <Sheet visible title="Add Product" subtitle="List a new material for sale." onClose={onClose}>
      <Field label="Product name *" value={name} onChangeText={setName} placeholder="e.g. Plywood 1/2 inch" />
      <ChipPicker label="Category" options={CATEGORIES} value={category} onChange={setCategory} />
      <Field label="Unit *" value={unit} onChangeText={setUnit} placeholder="bag, kg, pc, cu.m" autoCapitalize="none" />
      <Field label="Unit price (₱) *" value={price} onChangeText={setPrice} keyboardType="numeric" />
      <Field label="Stock on hand *" value={stock} onChangeText={setStock} keyboardType="numeric" />
      <Field label="Minimum order" value={minOrder} onChangeText={setMinOrder} keyboardType="numeric" />

      {error && <Text className="text-xs text-danger">{error}</Text>}
      <SubmitButton label="Add Product" onPress={save} />
    </Sheet>
  );
}
