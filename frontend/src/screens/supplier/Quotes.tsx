import { useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Badge, Button, Card, Field, PageHeader, Screen, SubmitButton } from "@/components/ui";
import Sheet from "@/components/Sheet";
import { fetchSupplierQuotes, submitBid, withdrawBid, type BidStatus, type SupplierQuoteRequest } from "@/services/api/quotes";
import { useFocusedResource } from "@/hooks/useFocusedResource";
import { peso } from "@/utils/currency";
import { QUOTE_STATUS } from "@/utils/quotes";
import { formatShortDate } from "@/utils/timeline";

const MY_BID: Record<BidStatus, { label: string; color: string }> = {
  pending: { label: "Bid placed", color: "#3b82f6" },
  accepted: { label: "You won", color: "#10b981" },
  rejected: { label: "Not selected", color: "#6b7280" },
  withdrawn: { label: "Withdrawn", color: "#6b7280" },
};

const digits = (value: string) => value.replace(/[^0-9]/g, "");

function BidSheet({ request, onClose, onDone }: { request: SupplierQuoteRequest; onClose: () => void; onDone: () => void }) {
  const mine = request.myBid;
  const [prices, setPrices] = useState<Record<number, string>>(() =>
    Object.fromEntries(request.items.map((item) => [item.id, String(mine?.items.find((b) => b.itemId === item.id)?.unitPrice ?? "")]))
  );
  const [days, setDays] = useState(mine ? String(mine.deliveryDays) : "");
  const [note, setNote] = useState(mine?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = request.items.reduce((sum, item) => sum + item.quantity * (parseInt(prices[item.id] || "0", 10) || 0), 0);

  const save = async () => {
    if (saving) return;
    const items = request.items.map((item) => ({ item_id: item.id, unit_price: Number(prices[item.id]) }));
    if (items.some((line) => !Number.isInteger(line.unit_price) || line.unit_price < 1)) {
      setError("Enter a whole-peso price for every item.");
      return;
    }
    const deliveryDays = Number(days);
    if (days.trim() === "" || !Number.isInteger(deliveryDays) || deliveryDays < 0 || deliveryDays > 90) {
      setError("Enter the delivery time in days, from 0 to 90.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await submitBid(request.id, { delivery_days: deliveryDays, note: note.trim() || undefined, items });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send your bid. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet visible title={mine ? "Edit your bid" : "Place a bid"} subtitle={request.title} onClose={onClose}>
      <View style={{ gap: 14 }}>
        {request.items.map((item) => (
          <Field
            key={item.id}
            label={`${item.materialName} · ${item.quantity} ${item.unit}`}
            keyboardType="number-pad"
            placeholder={`Price per ${item.unit} (₱)`}
            value={prices[item.id]}
            onChangeText={(v) => setPrices((p) => ({ ...p, [item.id]: digits(v) }))}
          />
        ))}
        <Field label="Delivery time (days)" keyboardType="number-pad" placeholder="e.g. 3" value={days} onChangeText={(v) => setDays(digits(v))} />
        <Field label="Note (optional)" multiline value={note} onChangeText={setNote} maxLength={500} placeholder="Delivery charges, payment terms, brand..." />
        <View className="flex-row items-center justify-between px-3 py-3 rounded-xl bg-muted">
          <Text className="text-xs text-muted-foreground">Your total</Text>
          <Text className="text-sm font-bold" style={{ color: "#10b981" }}>
            {peso(total)}
          </Text>
        </View>
        {error ? <Text className="text-xs text-danger">{error}</Text> : null}
        <SubmitButton label={saving ? "Sending…" : mine ? "Update bid" : "Send bid"} onPress={save} />
      </View>
    </Sheet>
  );
}

function RequestCard({ request, onBid, onChanged }: { request: SupplierQuoteRequest; onBid: () => void; onChanged: () => void }) {
  const [withdrawing, setWithdrawing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const open = request.status === "open";
  const mine = request.myBid;

  const withdraw = async () => {
    if (withdrawing) return;
    setWithdrawing(true);
    setError(null);
    try {
      await withdrawBid(request.id);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not withdraw your bid.");
    } finally {
      setWithdrawing(false);
    }
  };

  return (
    <Card gap={10}>
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-3" style={{ gap: 2 }}>
          <Text className="font-bold text-sm text-foreground">{request.title}</Text>
          <Text className="text-xs text-muted-foreground">
            {request.projectTitle ?? "Project"}
            {request.location ? ` · ${request.location}` : ""}
          </Text>
          {request.neededBy ? <Text className="text-xs text-muted-foreground">Needed by {formatShortDate(request.neededBy)}</Text> : null}
        </View>
        <View style={{ gap: 4, alignItems: "flex-end" }}>
          <Badge label={QUOTE_STATUS[request.status].label} color={QUOTE_STATUS[request.status].color} />
          {mine ? <Badge label={MY_BID[mine.status].label} color={MY_BID[mine.status].color} /> : null}
        </View>
      </View>

      <View style={{ gap: 4 }}>
        {request.items.map((item) => (
          <View key={item.id} className="flex-row items-center justify-between px-3 py-2 rounded-xl bg-muted">
            <Text className="flex-1 pr-3 text-xs text-foreground">{item.materialName}</Text>
            <Text className="text-xs text-muted-foreground">
              {item.quantity} {item.unit}
            </Text>
          </View>
        ))}
      </View>

      {request.notes ? <Text className="text-xs leading-5 text-secondary-foreground">Note: {request.notes}</Text> : null}

      {mine ? (
        <Text className="text-xs text-muted-foreground">
          Your bid: <Text className="font-semibold text-foreground">{peso(mine.total)}</Text> · delivers in {mine.deliveryDays}{" "}
          {mine.deliveryDays === 1 ? "day" : "days"}
        </Text>
      ) : (
        <Text className="text-xs text-muted-foreground">
          {request.bidCount === 0 ? "No bids yet." : `${request.bidCount} ${request.bidCount === 1 ? "supplier has" : "suppliers have"} bid so far.`}
        </Text>
      )}

      {error ? <Text className="text-xs text-danger">{error}</Text> : null}

      {open ? (
        <View className="flex-row gap-2">
          <View style={{ flex: 1 }}>
            <Button label={mine ? "Edit bid" : "Place bid"} onPress={onBid} />
          </View>
          {mine ? (
            <View style={{ flex: 1 }}>
              <Button label={withdrawing ? "Withdrawing…" : "Withdraw"} variant="tint" color="#ef4444" onPress={withdraw} />
            </View>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

export default function Quotes() {
  const { data, error, refresh } = useFocusedResource(fetchSupplierQuotes);
  const [bidding, setBidding] = useState<SupplierQuoteRequest | null>(null);

  return (
    <Screen topInset={false}>
      <PageHeader title="Bid Requests" subtitle="Homeowners and contractors ask for prices here. Bid on the ones you can supply." />

      {error ? <Text className="text-xs text-danger px-1">{error}</Text> : null}

      {!error && data === null ? (
        <View className="items-center py-10">
          <ActivityIndicator color="#f59e0b" />
        </View>
      ) : null}

      {data && data.length === 0 ? (
        <Text className="text-sm text-center text-muted-foreground py-10">No quote requests right now. New ones show up here and in your notifications.</Text>
      ) : null}

      {data?.map((request) => (
        <RequestCard key={request.id} request={request} onBid={() => setBidding(request)} onChanged={refresh} />
      ))}

      {bidding ? (
        <BidSheet
          request={bidding}
          onClose={() => setBidding(null)}
          onDone={() => {
            setBidding(null);
            void refresh();
          }}
        />
      ) : null}
    </Screen>
  );
}
