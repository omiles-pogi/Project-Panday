import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Badge, Button, Card, ChipPicker, Field, PageHeader, Screen, SubmitButton } from "@/components/ui";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import Sheet from "@/components/Sheet";
import {
  awardQuote,
  cancelQuoteRequest,
  createQuoteRequest,
  fetchQuoteRequests,
  type QuoteBid,
  type QuoteRequest,
} from "@/services/api/quotes";
import { fetchMyHomeownerProjects, fetchMyProjects } from "@/services/api/projects";
import { useFocusedResource } from "@/hooks/useFocusedResource";
import { peso } from "@/utils/currency";
import { QUOTE_STATUS } from "@/utils/quotes";
import { formatShortDate } from "@/utils/timeline";

type Viewer = "homeowner" | "contractor";

interface DraftRow {
  key: number;
  name: string;
  quantity: string;
  unit: string;
}

let nextKey = 1;
const blankRow = (): DraftRow => ({ key: nextKey++, name: "", quantity: "", unit: "pc" });

function NewRequestSheet({ viewer, onClose, onCreated }: { viewer: Viewer; onClose: () => void; onCreated: () => void }) {
  const [projects, setProjects] = useState<{ id: number; title: string }[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [neededBy, setNeededBy] = useState("");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<DraftRow[]>(() => [blankRow()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (viewer === "homeowner" ? fetchMyHomeownerProjects() : fetchMyProjects())
      .then((list) => {
        if (!cancelled) setProjects(list.filter((p) => p.status === "active").map((p) => ({ id: p.id, title: p.title })));
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Could not load your projects.");
      });
    return () => {
      cancelled = true;
    };
  }, [viewer]);

  // Two projects can share a name; the id keeps the chips apart.
  const label = (p: { id: number; title: string }) => (projects?.filter((o) => o.title === p.title).length ?? 0) > 1 ? `${p.title} #${p.id}` : p.title;
  const current = projects?.find((p) => p.id === projectId) ?? projects?.[0] ?? null;

  const setRow = (key: number, patch: Partial<DraftRow>) => setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const save = async () => {
    if (saving || !current) return;
    if (title.trim() === "") return setError("Give the request a short title.");
    if (neededBy.trim() !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(neededBy.trim())) return setError("Write the date as YYYY-MM-DD, or leave it empty.");
    const items = rows.map((r) => ({ material_name: r.name.trim(), unit: r.unit.trim(), quantity: Number(r.quantity) }));
    if (items.some((i) => i.material_name === "" || i.unit === "" || !Number.isInteger(i.quantity) || i.quantity < 1)) {
      return setError("Every item needs a name, a unit and a whole quantity of at least 1.");
    }
    setSaving(true);
    setError(null);
    try {
      await createQuoteRequest(current.id, {
        title: title.trim(),
        notes: notes.trim() || undefined,
        needed_by: neededBy.trim() || undefined,
        items,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the request. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet visible title="Request quotes" subtitle="Suppliers will bid a price for each item." onClose={onClose}>
      <View style={{ gap: 14 }}>
        {loadError ? <Text className="text-xs text-danger">{loadError}</Text> : null}
        {!loadError && projects === null ? <ActivityIndicator color="#f59e0b" /> : null}
        {projects && projects.length === 0 ? (
          <Text className="text-xs text-muted-foreground">{"You need an active project before you can ask for quotes."}</Text>
        ) : null}

        {projects && current ? (
          <>
            {projects.length > 1 ? (
              <ChipPicker
                label="Project"
                options={projects.map(label)}
                value={label(current)}
                onChange={(name) => setProjectId(projects.find((p) => label(p) === name)?.id ?? null)}
              />
            ) : (
              <Text className="text-xs text-muted-foreground">Project: {current.title}</Text>
            )}
            <Field label="Title" value={title} onChangeText={setTitle} maxLength={120} placeholder="e.g. Slab and columns materials" />
            <Field label="Needed by (optional)" value={neededBy} onChangeText={setNeededBy} placeholder="YYYY-MM-DD" maxLength={10} />

            <View style={{ gap: 10 }}>
              <Text className="text-xs font-medium text-secondary-foreground">Items</Text>
              {rows.map((row, index) => (
                <View key={row.key} className="p-3 rounded-xl bg-muted" style={{ gap: 8 }}>
                  <Field label={`Item ${index + 1}`} value={row.name} onChangeText={(v) => setRow(row.key, { name: v })} maxLength={120} placeholder="e.g. Portland Cement 40kg" />
                  <View className="flex-row gap-2">
                    <View style={{ flex: 1 }}>
                      <Field
                        label="Quantity"
                        keyboardType="number-pad"
                        value={row.quantity}
                        onChangeText={(v) => setRow(row.key, { quantity: v.replace(/[^0-9]/g, "") })}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Field label="Unit" value={row.unit} onChangeText={(v) => setRow(row.key, { unit: v })} maxLength={30} placeholder="bag, pc, m..." />
                    </View>
                  </View>
                  {rows.length > 1 ? (
                    <Pressable onPress={() => setRows((list) => list.filter((r) => r.key !== row.key))} className="self-end" hitSlop={8}>
                      <Text className="text-xs" style={{ color: "#ef4444" }}>
                        Remove item
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
              {rows.length < 30 ? <Button label="+ Add another item" variant="muted" onPress={() => setRows((list) => [...list, blankRow()])} /> : null}
            </View>

            <Field label="Notes (optional)" multiline value={notes} onChangeText={setNotes} maxLength={1000} placeholder="Delivery address, brands you prefer..." />
            {error ? <Text className="text-xs text-danger">{error}</Text> : null}
            <SubmitButton label={saving ? "Sending…" : "Send request"} onPress={save} />
          </>
        ) : null}
      </View>
    </Sheet>
  );
}

function BidRow({ request, bid, busy, onAward }: { request: QuoteRequest; bid: QuoteBid; busy: boolean; onAward: () => void }) {
  const won = bid.status === "accepted";
  const lost = bid.status === "rejected";
  const names = new Map(request.items.map((item) => [item.id, item]));
  return (
    <View className="p-3 rounded-xl bg-muted" style={{ gap: 6, borderWidth: won ? 1 : 0, borderColor: "#10b981" }}>
      <View className="flex-row items-center justify-between">
        <Text className="flex-1 pr-3 text-xs font-semibold text-foreground">{bid.supplierName ?? "Supplier"}</Text>
        <Text className="text-sm font-bold" style={{ color: lost ? "#6b7280" : "#10b981" }}>
          {peso(bid.total)}
        </Text>
      </View>
      <View className="flex-row flex-wrap gap-1.5">
        {bid.isLowest && request.status === "open" ? <Badge label="Lowest" color="#3b82f6" /> : null}
        {won ? <Badge label="Awarded" color="#10b981" /> : null}
        {lost ? <Badge label="Not selected" color="#6b7280" /> : null}
        <Badge label={`Delivers in ${bid.deliveryDays} ${bid.deliveryDays === 1 ? "day" : "days"}`} color="#8b5cf6" />
      </View>
      {bid.note ? <Text className="text-xs leading-5 text-secondary-foreground">{bid.note}</Text> : null}
      <View style={{ gap: 2 }}>
        {bid.items.map((line) => {
          const item = names.get(line.itemId);
          return (
            <Text key={line.itemId} className="text-xs text-muted-foreground">
              {item?.materialName ?? "Item"} · {item?.quantity} × {peso(line.unitPrice)} = {peso(line.subtotal)}
            </Text>
          );
        })}
      </View>
      {request.status === "open" && bid.status === "pending" ? (
        <Button label={busy ? "Awarding…" : "Award this quote"} onPress={onAward} />
      ) : null}
    </View>
  );
}

function RequestCard({ request, onChanged }: { request: QuoteRequest; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { ask, dialog } = useConfirmDialog();
  const meta = QUOTE_STATUS[request.status];

  const run = async (action: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await action();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't go through. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const award = (bid: QuoteBid) =>
    ask({
      title: "Award this quote?",
      detail: `${bid.supplierName ?? "This supplier"} · ${peso(bid.total)}`,
      message: "The other suppliers who bid will be told they weren't selected.",
      confirmLabel: "Award",
      icon: "trophy-outline",
      mood: "happy",
      onConfirm: () => void run(() => awardQuote(request.id, bid.id)),
    });

  const cancel = () =>
    ask({
      title: "Cancel this request?",
      detail: request.title,
      message: "Suppliers who already bid will be told it was cancelled.",
      confirmLabel: "Cancel request",
      cancelLabel: "Keep it",
      mood: "sad",
      tone: "danger",
      onConfirm: () => void run(() => cancelQuoteRequest(request.id)),
    });

  return (
    <Card gap={10}>
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-3" style={{ gap: 2 }}>
          <Text className="font-bold text-sm text-foreground">{request.title}</Text>
          <Text className="text-xs text-muted-foreground">{request.projectTitle ?? "Project"}</Text>
          <Text className="text-xs text-muted-foreground">
            {request.items.length} {request.items.length === 1 ? "item" : "items"}
            {request.neededBy ? ` · needed by ${formatShortDate(request.neededBy)}` : ""}
          </Text>
        </View>
        <Badge label={meta.label} color={meta.color} />
      </View>

      <Text className="text-xs text-muted-foreground" numberOfLines={3}>
        {request.items.map((i) => `${i.materialName} (${i.quantity} ${i.unit})`).join(" · ")}
      </Text>

      {request.bids.length === 0 ? (
        <View className="flex-row items-center gap-2 px-3 py-3 rounded-xl bg-muted">
          <Ionicons name="time-outline" size={16} color="#9ca3af" />
          <Text className="text-xs text-muted-foreground">{request.status === "open" ? "Waiting for suppliers to bid." : "No bids were placed."}</Text>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          {request.bids.map((bid) => (
            <BidRow key={bid.id} request={request} bid={bid} busy={busy} onAward={() => award(bid)} />
          ))}
        </View>
      )}

      {error ? <Text className="text-xs text-danger">{error}</Text> : null}
      {request.status === "open" ? <Button label="Cancel request" variant="tint" color="#ef4444" onPress={cancel} /> : null}

      {dialog}
    </Card>
  );
}

/** Supplier bidding, from the homeowner's or contractor's side: ask for quotes, compare the bids, award one. */
export default function QuoteRequests({ viewer }: { viewer: Viewer }) {
  const { data, error, refresh } = useFocusedResource(fetchQuoteRequests);
  const [creating, setCreating] = useState(false);

  return (
    <Screen topInset={false}>
      <PageHeader title="Supplier Quotes" subtitle="Ask suppliers for their best price, then pick a winner." />

      <SubmitButton label="Request quotes" onPress={() => setCreating(true)} />

      {error ? <Text className="text-xs text-danger px-1">{error}</Text> : null}

      {!error && data === null ? (
        <View className="items-center py-10">
          <ActivityIndicator color="#f59e0b" />
        </View>
      ) : null}

      {data && data.length === 0 ? (
        <Text className="text-sm text-center text-muted-foreground py-8">
          No quote requests yet. Send one and suppliers can start bidding.
        </Text>
      ) : null}

      {data?.map((request) => (
        <RequestCard key={request.id} request={request} onChanged={refresh} />
      ))}

      {creating ? (
        <NewRequestSheet
          viewer={viewer}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            void refresh();
          }}
        />
      ) : null}
    </Screen>
  );
}
