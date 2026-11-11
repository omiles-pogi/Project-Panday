import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { Badge, Button, Card, MONO, PageHeader, Screen, StatGrid, StatTile } from "@/components/ui";
import { ROLE_FLOATING_TAB_BAR_CLEARANCE } from "@/components/RoleFloatingTabBar";
import StockBadge from "@/components/StockBadge";
import { useAuth } from "@/context/AuthContext";
import { useSupplier } from "@/context/SupplierContext";
import { CAT_COLORS } from "@/data/supplier";
import { peso } from "@/utils/currency";
import InventoryStats from "./InventoryStats";

export default function Dashboard() {
  const { user } = useAuth();
  const { fulfillments, products, productsLoading, productsError } = useSupplier();

  const goToFulfillment = () => router.push("/supplier/fulfillment" as never);
  const pendingRequests = fulfillments.filter((o) => o.status === "supplier_review").length;
  const acceptedRequests = fulfillments.filter((o) => ["awaiting_homeowner_confirmation", "confirmed"].includes(o.status)).length;
  const completedRequests = fulfillments.filter((o) => o.status === "received").length;

  // Out-of-stock items first — they're the ones that need the supplier's attention.
  const inventoryPreview = [...products]
    .sort((a, b) => (a.stockStatus === b.stockStatus ? 0 : a.stockStatus === "out_of_stock" ? -1 : 1))
    .slice(0, 5);

  const goToInventory = () => router.push("/supplier/pricing" as never);

  return (
    <Screen extraBottomPadding={ROLE_FLOATING_TAB_BAR_CLEARANCE}>
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
          <Text className="text-xs text-muted-foreground">
            {'You haven\'t listed any materials yet — tap "Manage all" to add your first product.'}
          </Text>
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

      <StatGrid>
        <StatTile label="Pending Requests" value={pendingRequests} color="#f59e0b" icon="mail-unread-outline" onPress={goToFulfillment} />
        <StatTile label="Accepted Requests" value={acceptedRequests} color="#3b82f6" icon="cube-outline" onPress={goToFulfillment} />
        <StatTile label="Completed Requests" value={completedRequests} color="#10b981" icon="checkmark-circle-outline" onPress={goToFulfillment} />
      </StatGrid>
    </Screen>
  );
}
