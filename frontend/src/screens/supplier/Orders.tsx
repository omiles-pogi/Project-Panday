import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Badge, Button, Card, ChipPicker, Field, MONO, PageHeader, Screen, SubmitButton } from "@/components/ui";
import Sheet from "@/components/Sheet";
import StockBadge from "@/components/StockBadge";
import { ItemStatusBadge, ORDER_FLOW, ORDER_STATUS, OrderStatusBadge } from "@/components/MaterialStatusBadge";
import { useSupplier } from "@/context/SupplierContext";
import { useTheme } from "@/context/ThemeContext";
import {
  advanceSupplierOrder,
  confirmSupplierOrder,
  declineSupplierOrder,
  reportInsufficientStock,
} from "@/services/api/materialRequests";
import type { SupplierOrder, SupplierOrderStatus } from "@/types/materialRequest";
import { peso } from "@/utils/currency";

const FILTERS: Record<string, SupplierOrderStatus[] | null> = {
  Incoming: ["supplier_review"],
  Active: ["awaiting_homeowner_confirmation", "confirmed", "preparing", "for_delivery"],
  Completed: ["delivered", "received"],
  Closed: ["unavailable", "cancelled"],
  All: null,
};

const NEXT_STEP: Partial<Record<SupplierOrderStatus, { status: SupplierOrderStatus; label: string }>> = {
  confirmed: { status: "preparing", label: "Start Preparing" },
  preparing: { status: "for_delivery", label: "Mark Ready for Delivery" },
  for_delivery: { status: "delivered", label: "Mark as Delivered" },
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const WHOLE = /^\d+$/;
const errorMessage = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);
const formatDate = (iso: string) => new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });

/** Material orders from homeowner-approved requests — this supplier's items only. */
export default function Orders() {
  const { orders, ordersLoading, ordersError, reloadOrders } = useSupplier();
  // A notification tap lands here with ?orderId=… to open that order directly.
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  const [filter, setFilter] = useState("Incoming");
  const [openId, setOpenId] = useState<number | null>(null);

  useFocusEffect(reloadOrders);

  const targetId = openId ?? (orderId ? Number(orderId) : null);
  const open = orders.find((o) => o.id === targetId) ?? null;
  const statuses = FILTERS[filter];
  const shown = statuses ? orders.filter((o) => statuses.includes(o.status)) : orders;
  const counts = Object.fromEntries(Object.entries(FILTERS).map(([k, v]) => [k, v ? orders.filter((o) => v.includes(o.status)).length : orders.length]));

  return (
    <Screen>
      <PageHeader title="Material Orders" subtitle="Approved material requests for your inventory." badge="Supplier" />

      <ChipPicker
        label="Show"
        options={Object.keys(FILTERS).map((k) => `${k} (${counts[k]})`)}
        value={`${filter} (${counts[filter]})`}
        onChange={(v) => setFilter(v.replace(/ \(\d+\)$/, ""))}
      />

      {ordersLoading && orders.length === 0 ? (
        <View className="items-center py-10">
          <ActivityIndicator color="#f59e0b" />
        </View>
      ) : ordersError && orders.length === 0 ? (
        <Card gap={10}>
          <Text className="text-xs text-danger">{ordersError}</Text>
          <View className="flex-row">
            <Button label="Try Again" variant="muted" onPress={reloadOrders} />
          </View>
        </Card>
      ) : shown.length === 0 ? (
        <Card>
          <Text className="text-sm text-center text-muted-foreground py-6">
            {orders.length === 0
              ? "No material orders yet. They appear here once a homeowner approves a contractor's request for your materials."
              : "No orders in this view."}
          </Text>
        </Card>
      ) : (
        shown.map((o) => <OrderCard key={o.id} order={o} onPress={() => setOpenId(o.id)} />)
      )}

      {open && (
        <OrderSheet
          key={`${open.id}-${open.status}`}
          order={open}
          onClose={() => {
            setOpenId(null);
            if (orderId) router.setParams({ orderId: undefined });
          }}
        />
      )}
    </Screen>
  );
}

function OrderCard({ order: o, onPress }: { order: SupplierOrder; onPress: () => void }) {
  const short = o.items.some((i) => i.insufficientStock);
  const total = o.confirmedTotal > 0 ? o.confirmedTotal : o.estimatedTotal;
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <Card gap={8}>
        <View className="flex-row justify-between items-start gap-3">
          <View className="flex-1 gap-1">
            <Text className="text-sm font-bold text-foreground">{o.project?.title ?? `Request #${o.materialRequestId}`}</Text>
            <Text className="text-xs text-muted-foreground">
              Request #{o.materialRequestId} · {formatDate(o.requestDate)}
              {o.project?.location ? ` · ${o.project.location}` : ""}
            </Text>
            <Text className="text-xs text-muted-foreground">Contractor: {o.contractorName ?? "—"}</Text>
          </View>
          <View className="items-end gap-1">
            <OrderStatusBadge status={o.status} />
            <Text className="text-sm font-bold text-primary" style={{ fontFamily: MONO }}>
              {peso(total)}
            </Text>
            <Text className="text-xs text-muted-foreground">{o.confirmedTotal > 0 ? "confirmed" : "estimated"}</Text>
          </View>
        </View>
        <Text className="text-xs text-secondary-foreground" numberOfLines={2}>
          {o.items.map((i) => `${i.materialName} × ${i.quantity.toLocaleString()} ${i.unit}`).join(" · ")}
        </Text>
        {short && o.status === "supplier_review" && <Badge label="Insufficient stock for some items" color="#ef4444" />}
        {o.expectedDeliveryDate && <Text className="text-xs text-muted-foreground">Expected delivery: {formatDate(o.expectedDeliveryDate)}</Text>}
      </Card>
    </Pressable>
  );
}

function OrderSheet({ order: o, onClose }: { order: SupplierOrder; onClose: () => void }) {
  const { replaceOrder } = useSupplier();
  const { chrome } = useTheme();
  const reviewing = o.status === "supplier_review";
  const [prices, setPrices] = useState<Record<number, string>>(() =>
    Object.fromEntries(o.items.map((i) => [i.id, String(i.confirmedUnitPrice ?? i.currentListingPrice ?? i.estimatedUnitPrice)]))
  );
  const [deliveryDate, setDeliveryDate] = useState(o.expectedDeliveryDate ?? "");
  const [note, setNote] = useState(o.supplierNote ?? "");
  const [reason, setReason] = useState("");
  const [mode, setMode] = useState<"confirm" | "insufficient" | "decline">("confirm");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const short = o.items.filter((i) => i.insufficientStock);
  const finalTotal = o.items.reduce((sum, i) => sum + i.quantity * (Number(prices[i.id]) || 0), 0);
  const next = NEXT_STEP[o.status];
  const reached = ORDER_FLOW.indexOf(o.status === "awaiting_homeowner_confirmation" ? "supplier_review" : o.status);

  const run = async (action: () => Promise<SupplierOrder>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      replaceOrder(await action());
      onClose();
    } catch (err) {
      setError(errorMessage(err, "Something went wrong. Please try again."));
      setBusy(false);
    }
  };

  const confirm = () => {
    for (const i of o.items) {
      if (!WHOLE.test(prices[i.id] ?? "") || Number(prices[i.id]) < 1) return setError(`Enter a valid final price for ${i.materialName}.`);
    }
    if (deliveryDate && !DATE.test(deliveryDate)) return setError("Use YYYY-MM-DD for the delivery date.");
    run(() =>
      confirmSupplierOrder(
        o.id,
        o.items.map((i) => ({ id: i.id, unit_price: Number(prices[i.id]) })),
        deliveryDate || null,
        note
      )
    );
  };

  return (
    <Sheet visible title={o.project?.title ?? `Order #${o.id}`} subtitle={`Request #${o.materialRequestId} · Contractor ${o.contractorName ?? "—"}`} onClose={onClose}>
      <View className="flex-row flex-wrap items-center gap-2">
        <OrderStatusBadge status={o.status} />
        {o.project?.location ? <Text className="text-xs text-muted-foreground">Deliver to {o.project.location}</Text> : null}
      </View>

      {/* Progress through the fulfilment steps */}
      {!["unavailable", "cancelled"].includes(o.status) && (
        <View className="flex-row items-center">
          {ORDER_FLOW.map((step, idx) => (
            <View key={step} className="flex-1 items-center" style={{ gap: 4 }}>
              <View
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: idx <= reached ? ORDER_STATUS[step].color : chrome.muted }}
              />
              <Text className="text-center text-muted-foreground" style={{ fontSize: 9 }} numberOfLines={2}>
                {ORDER_STATUS[step].label}
              </Text>
            </View>
          ))}
        </View>
      )}

      {o.requestNotes ? (
        <View className="p-3 rounded-xl bg-muted">
          <Text className="text-xs text-muted-foreground">Contractor notes</Text>
          <Text className="text-xs text-foreground mt-0.5">{o.requestNotes}</Text>
        </View>
      ) : null}

      {o.items.map((i) => (
        <View key={i.id} className="p-3 rounded-xl bg-muted" style={{ gap: 6 }}>
          <View className="flex-row justify-between gap-2">
            <Text className="flex-1 text-sm font-semibold text-foreground">{i.materialName}</Text>
            <ItemStatusBadge status={i.status} />
          </View>
          <Text className="text-xs text-secondary-foreground">
            Requested: <Text className="font-semibold text-foreground">{i.quantity.toLocaleString()} {i.unit}</Text>
          </Text>
          {i.availableQuantity !== null && (
            <View className="flex-row flex-wrap items-center gap-2">
              {i.stockStatus && <StockBadge status={i.stockStatus} quantity={i.availableQuantity} unit={i.unit} />}
              {i.insufficientStock && <Badge label="Insufficient Stock" color="#ef4444" />}
              <Text className="text-xs text-muted-foreground">
                On hand {i.onHand?.toLocaleString()} · Reserved {i.reserved?.toLocaleString()}
              </Text>
            </View>
          )}
          <Text className="text-xs text-muted-foreground">
            Estimate {peso(i.estimatedUnitPrice)}/{i.unit}
            {i.confirmedUnitPrice !== null ? ` · Final ${peso(i.confirmedUnitPrice)}/${i.unit}` : ""}
          </Text>
          {reviewing && mode === "confirm" && (
            <Field
              label={`Final unit price (₱ per ${i.unit})`}
              value={prices[i.id]}
              onChangeText={(v) => setPrices((p) => ({ ...p, [i.id]: v }))}
              keyboardType="number-pad"
            />
          )}
        </View>
      ))}

      {reviewing ? (
        <>
          <ChipPicker
            label="Action"
            options={["Confirm & Accept", "Insufficient Stock", "Decline"]}
            value={mode === "confirm" ? "Confirm & Accept" : mode === "insufficient" ? "Insufficient Stock" : "Decline"}
            onChange={(v) => {
              setError(null);
              setMode(v === "Confirm & Accept" ? "confirm" : v === "Insufficient Stock" ? "insufficient" : "decline");
            }}
          />

          {mode === "confirm" && (
            <>
              {short.length > 0 && (
                <Text className="text-xs text-danger">
                  You don&apos;t have enough available stock for {short.map((i) => i.materialName).join(", ")}. Restock in Inventory first, or report
                  insufficient stock.
                </Text>
              )}
              <Field label="Expected delivery date (YYYY-MM-DD)" value={deliveryDate} onChangeText={setDeliveryDate} placeholder="2026-11-05" autoCapitalize="none" />
              <Field label="Note to contractor" value={note} onChangeText={setNote} multiline maxLength={1000} placeholder="Delivery window, pickup details…" />
              <View className="flex-row justify-between">
                <Text className="text-xs text-muted-foreground">Final total</Text>
                <Text className="text-sm font-bold text-primary" style={{ fontFamily: MONO }}>
                  {peso(finalTotal)}
                </Text>
              </View>
              {finalTotal !== o.estimatedTotal && (
                <Text className="text-xs text-muted-foreground">Prices differ from the estimate, so the homeowner will be asked to confirm them.</Text>
              )}
              <Text className="text-xs text-muted-foreground">Confirming reserves the full requested quantities from your stock.</Text>
              {error && <Text className="text-xs text-danger">{error}</Text>}
              <SubmitButton label={busy ? "Confirming…" : "Confirm & Accept Order"} onPress={confirm} />
            </>
          )}

          {mode !== "confirm" && (
            <>
              <Field
                label={mode === "decline" ? "Reason for declining *" : "Note (e.g. when you'll have stock)"}
                value={reason}
                onChangeText={setReason}
                multiline
                maxLength={1000}
              />
              <Text className="text-xs text-muted-foreground">
                The request goes back to the contractor to revise quantities or choose another supplier. No stock is reserved.
              </Text>
              {error && <Text className="text-xs text-danger">{error}</Text>}
              <Pressable
                onPress={() => {
                  if (mode === "decline" && !reason.trim()) return setError("Give a reason for declining.");
                  run(() => (mode === "decline" ? declineSupplierOrder(o.id, reason.trim()) : reportInsufficientStock(o.id, reason)));
                }}
                className="py-4 rounded-2xl items-center"
                style={{ backgroundColor: "#ef444420" }}
              >
                <Text className="font-bold text-sm text-danger">
                  {busy ? "Sending…" : mode === "decline" ? "Decline Order" : "Report Insufficient Stock"}
                </Text>
              </Pressable>
            </>
          )}
        </>
      ) : (
        <>
          <View className="flex-row justify-between">
            <Text className="text-xs text-muted-foreground">Confirmed total</Text>
            <Text className="text-sm font-bold text-primary" style={{ fontFamily: MONO }}>
              {peso(o.confirmedTotal || o.estimatedTotal)}
            </Text>
          </View>
          {o.expectedDeliveryDate && <Text className="text-xs text-muted-foreground">Expected delivery: {formatDate(o.expectedDeliveryDate)}</Text>}
          {o.supplierNote ? <Text className="text-xs text-muted-foreground">Your note: {o.supplierNote}</Text> : null}
          {o.declineReason ? <Text className="text-xs text-danger">Reason: {o.declineReason}</Text> : null}
          {o.status === "awaiting_homeowner_confirmation" && (
            <View className="flex-row items-center gap-2 p-3 rounded-xl" style={{ backgroundColor: "#f9731615" }}>
              <Ionicons name="time-outline" size={16} color="#f97316" />
              <Text className="flex-1 text-xs" style={{ color: "#f97316" }}>
                Waiting for the homeowner to accept your final prices. Stock is reserved meanwhile.
              </Text>
            </View>
          )}
          {o.status === "delivered" && <Text className="text-xs text-muted-foreground">Waiting for the contractor to confirm receipt.</Text>}
          {error && <Text className="text-xs text-danger">{error}</Text>}
          {next && (
            <SubmitButton
              label={busy ? "Updating…" : next.label}
              onPress={() => run(() => advanceSupplierOrder(o.id, next.status))}
            />
          )}
          {next?.status === "delivered" && (
            <Text className="text-xs text-center text-muted-foreground">Marking delivered deducts the reserved units from your on-hand stock.</Text>
          )}
        </>
      )}
    </Sheet>
  );
}
