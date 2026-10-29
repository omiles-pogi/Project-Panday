import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Badge, Button, Card, InfoBox, MONO, PageHeader, Screen, StatGrid, StatTile } from "@/components/ui";
import StockBadge from "@/components/StockBadge";
import { useAuth } from "@/context/AuthContext";
import { useSupplier } from "@/context/SupplierContext";
import { CAT_COLORS } from "@/data/supplier";
import { peso } from "@/utils/currency";
import InventoryStats from "./InventoryStats";

const QUICK_ACTIONS = [
  { label: "Inventory", icon: "layers-outline", href: "/supplier/pricing" },
  { label: "Bids", icon: "pricetag-outline", href: "/supplier/bids" },
  { label: "Orders", icon: "cube-outline", href: "/supplier/orders" },
  { label: "More", icon: "ellipsis-horizontal", href: "/supplier/more" },
] as const;

export default function Dashboard() {
  const { user } = useAuth();
  const { bids, orders, products, productsLoading, productsError } = useSupplier();

  const activeBids = bids.filter((b) => b.status === "open" || b.status === "submitted").length;
  const goToOrders = () => router.push("/supplier/orders" as never);
  const pendingRequests = orders.filter((o) => o.status === "supplier_review").length;
  const acceptedRequests = orders.filter((o) =>
    ["awaiting_homeowner_confirmation", "confirmed", "preparing", "for_delivery"].includes(o.status)
  ).length;
  const completedRequests = orders.filter((o) => o.status === "delivered" || o.status === "received").length;

  const openBids = bids.filter((b) => b.status === "open").slice(0, 3);
  // Out-of-stock items first — they're the ones that need the supplier's attention.
  const inventoryPreview = [...products]
    .sort((a, b) => (a.stockStatus === b.stockStatus ? 0 : a.stockStatus === "out_of_stock" ? -1 : 1))
    .slice(0, 5);

  const goToInventory = () => router.push("/supplier/pricing" as never);

  return (
    <Screen>
      <PageHeader title={`Hello, ${user?.name ?? "Supplier"}`} subtitle="Your supplier portal at a glance." />

      <InventoryStats products={products} onPress={goToInventory} />

      <Card
        title="Material Inventory"
        gap={8}
        right={
          <Pressable onPress={goToInventory}>
            <Text className="text-xs font-semibold text-primary">Manage all</Text>
          </Pressable>
        }
      >
        {productsLoading && products.length === 0 ? (
          <ActivityIndicator color="#f59e0b" />
        ) : productsError && products.length === 0 ? (
          <Text className="text-xs text-danger">{productsError}</Text>
        ) : products.length === 0 ? (
          <Text className="text-xs text-muted-foreground">{"You haven't listed any materials yet."}</Text>
        ) : (
          inventoryPreview.map((p) => (
            <Pressable key={p.id} onPress={goToInventory} className="px-3 py-2.5 rounded-xl bg-muted" style={{ gap: 6 }}>
              <View className="flex-row items-center justify-between gap-2">
                <Text className="flex-1 text-sm font-semibold text-foreground" numberOfLines={1}>
                  {p.name}
                </Text>
                <Text className="text-xs font-semibold text-foreground" style={{ fontFamily: MONO }}>
                  {peso(p.price)}/{p.unit}
                </Text>
              </View>
              <View className="flex-row flex-wrap items-center gap-2">
                <Badge label={p.category} color={CAT_COLORS[p.category] ?? CAT_COLORS.Other} />
                <StockBadge status={p.stockStatus} quantity={p.availableQuantity} unit={p.unit} />
                {!p.isActive && <Badge label="Hidden" color="#6b7280" />}
              </View>
            </Pressable>
          ))
        )}
        <View className="flex-row mt-1">
          <Button label="+ Add Material" onPress={() => router.push("/supplier/pricing?add=1" as never)} />
        </View>
      </Card>

      <View className="flex-row flex-wrap gap-2">
        {QUICK_ACTIONS.map(({ label, icon, href }) => (
          <Pressable
            key={href}
            onPress={() => router.push(href as never)}
            className="items-center gap-1.5 py-3.5 rounded-2xl bg-card border border-border"
            style={{ width: "23%" }}
          >
            <Ionicons name={icon} size={22} color="#f59e0b" />
            <Text className="text-xs font-semibold text-muted-foreground">{label}</Text>
          </Pressable>
        ))}
      </View>

      <StatGrid>
        <StatTile label="Pending Requests" value={pendingRequests} color="#f59e0b" icon="mail-unread-outline" onPress={goToOrders} />
        <StatTile label="Accepted Requests" value={acceptedRequests} color="#3b82f6" icon="cube-outline" onPress={goToOrders} />
        <StatTile label="Completed Requests" value={completedRequests} color="#10b981" icon="checkmark-circle-outline" onPress={goToOrders} />
        <StatTile label="Active Bids" value={activeBids} color="#8b5cf6" icon="pricetag-outline" />
      </StatGrid>

      <Card
        title="New Bid Requests"
        gap={10}
        right={
          <Pressable onPress={() => router.push("/supplier/bids" as never)}>
            <Text className="text-xs font-semibold text-primary">See all</Text>
          </Pressable>
        }
      >
        {openBids.length === 0 ? (
          <Text className="text-xs text-muted-foreground">No open requests right now.</Text>
        ) : (
          openBids.map((b) => (
            <View key={b.id} className="p-3 rounded-xl bg-muted">
              <View className="flex-row justify-between gap-3">
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-foreground">{b.project}</Text>
                  <Text className="text-xs mt-0.5 text-secondary-foreground">
                    {b.material} · {b.qty.toLocaleString()} {b.unit}
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="text-sm font-bold text-primary" style={{ fontFamily: MONO }}>
                    {peso(b.budget)}
                  </Text>
                  <Text className="text-xs text-muted-foreground">Due {b.deadline}</Text>
                </View>
              </View>
              <View className="mt-3 flex-row">
                <Button label="Submit Bid" variant="tint" color="#f59e0b" onPress={() => router.push("/supplier/bids" as never)} />
              </View>
            </View>
          ))
        )}
      </Card>

      <InfoBox color="#3b82f6" title="AI Insight">
        3 new residential projects in Metro Manila were approved and need cement, steel and aggregate. Keep your prices
        competitive to win more bids.
      </InfoBox>
    </Screen>
  );
}
