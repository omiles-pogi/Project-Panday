import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Badge, Button, Card, ChipPicker, Field, MONO, PageHeader, ProgressBar, Screen, SubmitButton } from "@/components/ui";
import Sheet from "@/components/Sheet";
import { useSupplier } from "@/context/SupplierContext";
import { ORDER_FLOW, ORDER_STATUS, type Order, type OrderStatus } from "@/data/supplier";
import { peso } from "@/utils/currency";

const FILTERS = ["All", "Active", "Delivered", "Cancelled"] as const;

export default function Orders() {
  const { orders } = useSupplier();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [editing, setEditing] = useState<Order | null>(null);

  const shown = orders.filter((o) => {
    if (filter === "Active") return o.status !== "delivered" && o.status !== "cancelled";
    if (filter === "Delivered") return o.status === "delivered";
    if (filter === "Cancelled") return o.status === "cancelled";
    return true;
  });

  return (
    <Screen>
      <PageHeader title="Orders" subtitle="Track deliveries and payments." badge="Supplier" />

      <ChipPicker label="Show" options={[...FILTERS]} value={filter} onChange={(v) => setFilter(v as typeof filter)} />

      {shown.length === 0 && <Text className="text-xs text-muted-foreground">No orders in this view.</Text>}

      {shown.map((o) => {
        const s = ORDER_STATUS[o.status];
        const paidPct = o.amount > 0 ? (o.amountPaid / o.amount) * 100 : 0;
        const closed = o.status === "delivered" || o.status === "cancelled";
        return (
          <Card key={o.id} gap={10}>
            <View className="flex-row justify-between items-start gap-3">
              <View className="flex-1">
                <Text className="text-xs text-muted-foreground" style={{ fontFamily: MONO }}>
                  {o.id}
                </Text>
                <Text className="text-sm font-bold text-foreground">{o.project}</Text>
                <Text className="text-xs text-muted-foreground mt-0.5">
                  {o.homeowner} · {o.location}
                </Text>
              </View>
              <Badge label={s.label} color={s.color} />
            </View>

            <View className="p-3 rounded-xl bg-muted gap-1">
              <Text className="text-sm text-foreground">{o.material}</Text>
              <Text className="text-xs text-secondary-foreground">
                {o.qty.toLocaleString()} {o.unit} · Deliver by {o.deliveryDate}
              </Text>
              {o.note ? <Text className="text-xs text-muted-foreground mt-1">Note: {o.note}</Text> : null}
            </View>

            <View>
              <View className="flex-row justify-between mb-1.5">
                <Text className="text-xs text-muted-foreground">Paid {peso(o.amountPaid)}</Text>
                <Text className="text-xs font-semibold text-foreground" style={{ fontFamily: MONO }}>
                  {peso(o.amount)}
                </Text>
              </View>
              <ProgressBar pct={paidPct} color={paidPct >= 100 ? "#10b981" : "#f59e0b"} />
            </View>

            {!closed && (
              <View className="flex-row">
                <Button label="Update Status" onPress={() => setEditing(o)} />
              </View>
            )}
          </Card>
        );
      })}

      {editing && <OrderSheet key={editing.id} order={editing} onClose={() => setEditing(null)} />}
    </Screen>
  );
}

function OrderSheet({ order, onClose }: { order: Order; onClose: () => void }) {
  const { updateOrder } = useSupplier();
  const [status, setStatus] = useState<OrderStatus>(order.status);
  const [note, setNote] = useState("");

  const reached = ORDER_FLOW.indexOf(status);

  return (
    <Sheet visible title="Update Order" subtitle={`${order.id} · ${order.material}`} onClose={onClose}>
      <View className="flex-row items-start">
        {ORDER_FLOW.map((step, i) => {
          const meta = ORDER_STATUS[step];
          const done = reached >= i;
          return (
            <View key={step} className="flex-1 flex-row items-center">
              <Pressable onPress={() => setStatus(step)} className="items-center gap-1" style={{ width: 56 }}>
                <View
                  className="w-10 h-10 rounded-full items-center justify-center"
                  style={{ backgroundColor: done ? meta.color : "#252a3a", borderWidth: 2, borderColor: done ? meta.color : "#2a2f42" }}
                >
                  <Ionicons name={meta.icon} size={18} color={done ? "#fff" : "#4b5563"} />
                </View>
                <Text className="text-center" style={{ fontSize: 10, color: done ? meta.color : "#6b7280" }}>
                  {meta.label}
                </Text>
              </Pressable>
              {i < ORDER_FLOW.length - 1 && (
                <View className="flex-1 h-0.5 -mt-4" style={{ backgroundColor: reached > i ? ORDER_STATUS[ORDER_FLOW[i + 1]].color : "#252a3a" }} />
              )}
            </View>
          );
        })}
      </View>

      <Field
        label="Update note (optional)"
        value={note}
        onChangeText={setNote}
        multiline
        placeholder={
          status === "ready"
            ? "e.g. Items loaded and ready for pickup"
            : status === "in-transit"
              ? "e.g. Truck dispatched, ETA 2 hours"
              : status === "delivered"
                ? "e.g. Delivered and received by client"
                : "Notes on this order…"
        }
      />

      <SubmitButton
        label="Save Update"
        onPress={() => {
          updateOrder(order.id, status, note);
          onClose();
        }}
      />

      <Pressable
        onPress={() => {
          updateOrder(order.id, "cancelled", note);
          onClose();
        }}
        className="py-3 rounded-2xl items-center border border-border"
      >
        <Text className="text-sm font-semibold text-danger">Cancel Order</Text>
      </Pressable>
    </Sheet>
  );
}
