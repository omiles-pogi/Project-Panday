import { useState } from "react";
import { Text, View } from "react-native";
import { Badge, Button, Card, ChipPicker, Field, InfoBox, MONO, PageHeader, Screen, SubmitButton } from "@/components/ui";
import Sheet from "@/components/Sheet";
import { useSupplier } from "@/context/SupplierContext";
import { BID_STATUS, PAYMENT_TERMS, type BidRequest, type BidStatus } from "@/data/supplier";
import { peso } from "@/utils/currency";

const FILTERS: ("all" | BidStatus)[] = ["all", "open", "submitted", "won", "lost"];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export default function Bids() {
  const { bids } = useSupplier();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [editing, setEditing] = useState<BidRequest | null>(null);

  const shown = filter === "all" ? bids : bids.filter((b) => b.status === filter);

  return (
    <Screen>
      <PageHeader title="Bid Requests" subtitle="Homeowners and contractors asking for quotes." badge="Supplier" />

      <ChipPicker
        label="Show"
        options={FILTERS.map((f) => (f === "all" ? "All" : BID_STATUS[f].label))}
        value={filter === "all" ? "All" : BID_STATUS[filter].label}
        onChange={(label) => setFilter(FILTERS.find((f) => (f === "all" ? "All" : BID_STATUS[f].label) === label) ?? "all")}
      />

      {shown.length === 0 && <Text className="text-xs text-muted-foreground">No bids in this view.</Text>}

      {shown.map((b) => {
        const s = BID_STATUS[b.status];
        return (
          <Card key={b.id} gap={10}>
            <View className="flex-row justify-between items-start gap-3">
              <View className="flex-1">
                <Text className="text-sm font-bold text-foreground">{b.project}</Text>
                <Text className="text-xs text-muted-foreground mt-0.5">
                  {b.homeowner} · {b.location}
                </Text>
              </View>
              <Badge label={s.label} color={s.color} />
            </View>

            <View className="p-3 rounded-xl bg-muted gap-1">
              <Text className="text-sm text-foreground">{b.material}</Text>
              <Text className="text-xs text-secondary-foreground">
                {b.qty.toLocaleString()} {b.unit} · Budget {peso(b.budget)} · Due {b.deadline}
              </Text>
            </View>

            {b.myBid != null && (
              <View className="flex-row justify-between items-center">
                <Text className="text-xs text-muted-foreground">Your bid</Text>
                <Text className="text-sm font-bold" style={{ color: b.myBid > b.budget ? "#ef4444" : "#10b981", fontFamily: MONO }}>
                  {peso(b.myBid)}
                </Text>
              </View>
            )}

            {(b.status === "open" || b.status === "submitted") && (
              <View className="flex-row">
                <Button
                  label={b.status === "open" ? "Submit Bid" : "Edit Bid"}
                  variant={b.status === "open" ? "primary" : "tint"}
                  color="#f59e0b"
                  onPress={() => setEditing(b)}
                />
              </View>
            )}
          </Card>
        );
      })}

      {editing && <BidSheet key={editing.id} bid={editing} onClose={() => setEditing(null)} />}
    </Screen>
  );
}

function BidSheet({ bid, onClose }: { bid: BidRequest; onClose: () => void }) {
  const { submitBid } = useSupplier();
  const [unitPrice, setUnitPrice] = useState(bid.myBid ? String(Math.round(bid.myBid / bid.qty)) : "");
  const [delivery, setDelivery] = useState(bid.deliveryDate);
  const [terms, setTerms] = useState(bid.paymentTerms || PAYMENT_TERMS[0]);
  const [notes, setNotes] = useState(bid.notes);
  const [errors, setErrors] = useState<{ price?: string; delivery?: string }>({});

  const price = Number(unitPrice);
  const total = price > 0 ? Math.round(price * bid.qty) : 0;
  const over = total > bid.budget;

  const submit = () => {
    const e: typeof errors = {};
    if (!(price > 0)) e.price = "Enter a valid unit price.";
    if (!DATE_PATTERN.test(delivery)) e.delivery = "Use the format YYYY-MM-DD.";
    setErrors(e);
    if (Object.keys(e).length) return;
    submitBid(bid.id, { total, deliveryDate: delivery, paymentTerms: terms, notes: notes.trim() });
    onClose();
  };

  return (
    <Sheet visible title={bid.status === "open" ? "Submit Bid" : "Edit Bid"} subtitle={`${bid.project} · ${bid.material}`} onClose={onClose}>
      <View className="p-3 rounded-xl bg-muted">
        <Text className="text-xs text-muted-foreground">
          {bid.qty.toLocaleString()} {bid.unit} · Client budget {peso(bid.budget)} · Due {bid.deadline}
        </Text>
      </View>

      <View>
        <Field label={`Your unit price (₱ per ${bid.unit}) *`} value={unitPrice} onChangeText={setUnitPrice} keyboardType="numeric" placeholder="0.00" />
        {errors.price && <Text className="text-xs mt-1 text-danger">{errors.price}</Text>}
      </View>

      {total > 0 && (
        <InfoBox color={over ? "#ef4444" : "#10b981"}>
          <View className="flex-row justify-between items-center">
            <Text className="text-sm font-semibold text-foreground">Your total bid</Text>
            <Text className="text-lg font-bold" style={{ color: over ? "#ef4444" : "#10b981", fontFamily: MONO }}>
              {peso(total)}
            </Text>
          </View>
          <Text className="text-xs mt-1" style={{ color: over ? "#ef4444" : "#10b981" }}>
            {((total / bid.budget) * 100).toFixed(1)}% of budget · {over ? "over budget" : "within budget"}
          </Text>
        </InfoBox>
      )}

      <View>
        <Field label="Committed delivery date *" value={delivery} onChangeText={setDelivery} placeholder="YYYY-MM-DD" autoCapitalize="none" />
        {errors.delivery && <Text className="text-xs mt-1 text-danger">{errors.delivery}</Text>}
      </View>

      <ChipPicker label="Payment terms" options={PAYMENT_TERMS} value={terms} onChange={setTerms} />
      <Field label="Notes (optional)" value={notes} onChangeText={setNotes} multiline placeholder="e.g. Free delivery within Metro Manila" />

      <SubmitButton label={bid.status === "open" ? "Submit Bid" : "Save Changes"} onPress={submit} />
    </Sheet>
  );
}
