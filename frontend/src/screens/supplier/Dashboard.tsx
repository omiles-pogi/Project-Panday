import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Badge, Button, Card, InfoBox, MONO, PageHeader, Screen, StatGrid, StatTile } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useSupplier } from "@/context/SupplierContext";
import { DEMAND_COLORS, TREND_ICON } from "@/data/supplier";
import { peso } from "@/utils/currency";

const QUICK_ACTIONS = [
  { label: "Bids", icon: "pricetag-outline", href: "/supplier/bids" },
  { label: "Orders", icon: "cube-outline", href: "/supplier/orders" },
  { label: "Pricing", icon: "cash-outline", href: "/supplier/pricing" },
  { label: "More", icon: "ellipsis-horizontal", href: "/supplier/more" },
] as const;

export default function Dashboard() {
  const { user } = useAuth();
  const { bids, orders, products } = useSupplier();

  const activeBids = bids.filter((b) => b.status === "open" || b.status === "submitted").length;
  const openOrders = orders.filter((o) => o.status !== "delivered" && o.status !== "cancelled").length;
  const fulfilled = orders.filter((o) => o.status === "delivered").length;
  const revenue = orders.reduce((sum, o) => sum + o.amountPaid, 0);

  const openBids = bids.filter((b) => b.status === "open").slice(0, 3);
  const hot = products.filter((p) => p.available && p.demand === "High").slice(0, 4);

  return (
    <Screen>
      <PageHeader title={`Hello, ${user?.name ?? "Supplier"}`} subtitle="Your supplier portal at a glance." />

      <StatGrid>
        <StatTile label="Active Bids" value={activeBids} color="#f59e0b" icon="pricetag-outline" />
        <StatTile label="Open Orders" value={openOrders} color="#3b82f6" icon="cube-outline" />
        <StatTile label="Fulfilled Orders" value={fulfilled} color="#10b981" icon="checkmark-circle-outline" />
        <StatTile label="Collected" value={peso(revenue)} color="#8b5cf6" icon="wallet-outline" />
      </StatGrid>

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

      <Card title="In-Demand Products" gap={8}>
        {hot.map((p) => (
          <View key={p.id} className="flex-row items-center justify-between px-3 py-2.5 rounded-xl bg-muted">
            <Text className="flex-1 text-sm text-secondary-foreground" numberOfLines={1}>
              {p.name}
            </Text>
            <View className="flex-row items-center gap-2">
              <Text className="text-xs font-semibold text-foreground" style={{ fontFamily: MONO }}>
                {peso(p.price)}/{p.unit}
              </Text>
              <Badge label={p.demand} color={DEMAND_COLORS[p.demand]} />
              <Ionicons name={TREND_ICON[p.trend].icon} size={16} color={TREND_ICON[p.trend].color} />
            </View>
          </View>
        ))}
      </Card>
    </Screen>
  );
}
