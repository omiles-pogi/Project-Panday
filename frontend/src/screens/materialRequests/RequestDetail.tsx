import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Stack, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Badge, Button, Card, Field, MONO, Screen, SubmitButton } from "@/components/ui";
import Sheet from "@/components/Sheet";
import { CountUp } from "@/components/charts";
import StockBadge from "@/components/StockBadge";
import MessageButton from "@/components/MessageButton";
import ExportPdfButton from "@/components/ExportPdfButton";
import { ItemStatusBadge, OrderStatusBadge, RequestStatusBadge, statusLabel } from "@/components/MaterialStatusBadge";
import { useTheme } from "@/context/ThemeContext";
import { colors } from "@/theme/colors";
import {
  approveMaterialRequest,
  cancelMaterialRequest,
  confirmOrderPrices,
  declineOrderPrices,
  fetchAiMaterials,
  fetchMaterialRequest,
  receiveSupplierOrder,
  rejectMaterialRequest,
  requestMaterialRevision,
  saveMaterialRequest,
  submitMaterialRequest,
} from "@/services/api/materialRequests";
import { fetchMaterialCatalog, type CatalogMaterialDto } from "@/services/api/supplierProducts";
import type { AiMaterialSuggestion, MaterialItemInput, MaterialRequest, MaterialRequestOrder } from "@/types/materialRequest";
import { peso } from "@/utils/currency";
import { materialRequestPdfHtml, sharePdf } from "@/utils/pdf";
import { formatShortDate } from "@/utils/timeline";

type Viewer = "contractor" | "homeowner";

/** A line in the contractor's editor. Listed items carry a listing id; unmatched AI lines don't (yet). */
interface DraftItem {
  key: string;
  id?: number;
  supplierProductId: number | null;
  supplierName: string | null;
  materialName: string;
  unit: string;
  quantity: string;
  unitPrice: number;
  availableQuantity: number | null;
  source: "manual" | "ai";
  /** The AI's estimate and what the reviewed plan allows, when the item is in the plan (set by the server on save). */
  aiQuantity: number | null;
  planQuantity: number | null;
  /** The AI's own wording, when the listing was only the closest one it could find — so the contractor checks it. */
  similarTo?: string;
}

let keySeq = 0;
const newKey = () => `k${++keySeq}`;
const WHOLE = /^\d+$/;
const errorMessage = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);
const formatDateTime = (iso: string) => new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function toDraftItems(r: MaterialRequest): DraftItem[] {
  return r.items
    .filter((i) => !i.locked)
    .map((i) => ({
      key: newKey(),
      id: i.id,
      supplierProductId: i.supplierProductId,
      supplierName: i.supplierName,
      materialName: i.materialName,
      unit: i.unit,
      quantity: String(i.quantity),
      unitPrice: i.estimatedUnitPrice,
      availableQuantity: i.availableQuantity,
      source: i.source,
      aiQuantity: i.aiQuantity,
      planQuantity: i.planQuantity,
    }));
}

function fromListing(m: CatalogMaterialDto, quantity: string, source: DraftItem["source"], key = newKey(), id?: number): DraftItem {
  return {
    key,
    id,
    supplierProductId: m.id,
    supplierName: m.supplier.business_name || m.supplier.name,
    materialName: m.name,
    unit: m.unit,
    quantity,
    unitPrice: m.price,
    availableQuantity: m.available_quantity,
    source,
    aiQuantity: null,
    planQuantity: null,
  };
}

function toInput(d: DraftItem): MaterialItemInput {
  const base = { ...(d.id ? { id: d.id } : {}), quantity: Number(d.quantity), source: d.source };
  return d.supplierProductId
    ? { ...base, supplier_product_id: d.supplierProductId }
    : { ...base, supplier_product_id: null, material_name: d.materialName, unit: d.unit, estimated_unit_price: d.unitPrice };
}

/** One material request, for its contractor (edit/submit/receive) or its homeowner (approve/track). */
export default function RequestDetail({ requestId, viewer }: { requestId: number; viewer: Viewer }) {
  const [request, setRequest] = useState<MaterialRequest | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchMaterialRequest(requestId)
      .then((r) => {
        setRequest(r);
        setLoadError(null);
      })
      .catch((err) => setLoadError(errorMessage(err, "Could not load this request.")));
  }, [requestId]);

  useFocusEffect(load);

  if (loadError && !request) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6" style={{ gap: 8 }}>
        <Stack.Screen options={{ title: "Material Request" }} />
        <Text className="text-sm text-center text-danger">{loadError}</Text>
        <Button label="Try Again" variant="muted" onPress={load} />
      </View>
    );
  }
  if (!request) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Stack.Screen options={{ title: "Material Request" }} />
        <ActivityIndicator color="#f59e0b" />
      </View>
    );
  }

  return <RequestDetailBody key={`${request.id}-${request.status}-${request.updatedAt}`} request={request} viewer={viewer} onChange={setRequest} />;
}

function RequestDetailBody({ request: r, viewer, onChange }: { request: MaterialRequest; viewer: Viewer; onChange: (r: MaterialRequest) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reasonFor, setReasonFor] = useState<null | "revision" | "reject" | "cancel" | { declineOrder: number }>(null);

  const run = async (action: () => Promise<MaterialRequest>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await action());
    } catch (err) {
      setError(errorMessage(err, "Something went wrong. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  const total = r.confirmedTotal > 0 ? r.confirmedTotal : r.estimatedTotal;
  const closed = ["completed", "rejected", "cancelled"].includes(r.status);
  const received = r.orders.some((o) => o.status === "received");
  const canCancel = !closed && !received && (viewer === "contractor" || r.status !== "draft");
  const locked = r.items.filter((i) => i.locked);

  return (
    <Screen topInset={false}>
      <Stack.Screen options={{ title: `Material Request #${r.id}` }} />

      <Card gap={8}>
        <View className="flex-row justify-between items-start gap-3">
          <View className="flex-1 gap-1">
            <Text className="text-base font-bold text-foreground">{r.project.title}</Text>
            <Text className="text-xs text-muted-foreground">
              Contractor {r.contractor.name} · Homeowner {r.homeowner.name}
            </Text>
            <Text className="text-xs text-muted-foreground">
              {r.submittedAt ? `Submitted ${formatDateTime(r.submittedAt)}` : `Created ${formatDateTime(r.createdAt)}`}
            </Text>
          </View>
          <RequestStatusBadge status={r.status} />
        </View>
        <View className="flex-row gap-3">
          <View className="flex-1 p-2.5 rounded-xl bg-muted">
            <Text className="text-xs text-muted-foreground">Estimated total</Text>
            <Text className="text-sm font-bold text-foreground" style={{ fontFamily: MONO }}>
              {peso(r.estimatedTotal)}
            </Text>
          </View>
          <View className="flex-1 p-2.5 rounded-xl bg-muted">
            <Text className="text-xs text-muted-foreground">Supplier-confirmed</Text>
            <Text className="text-sm font-bold text-primary" style={{ fontFamily: MONO }}>
              {r.confirmedTotal > 0 ? peso(r.confirmedTotal) : "—"}
            </Text>
          </View>
        </View>
        {(r.phase || r.autoApproved) && (
          <View className="flex-row flex-wrap items-center gap-2">
            {r.phase && <Badge label={`For ${r.phase.name}`} color="#8b5cf6" />}
            {r.neededBy && <Text className="text-xs text-muted-foreground">Needed by {formatShortDate(r.neededBy)}</Text>}
            {r.autoApproved && <Badge label="Auto-approved" color="#3b82f6" />}
          </View>
        )}
        {r.decisionReason && ["revision_requested", "rejected", "cancelled"].includes(r.status) && (
          <View className="p-3 rounded-xl" style={{ backgroundColor: `${colors.warning}15` }}>
            <Text className="text-xs font-semibold" style={{ color: colors.warning }}>
              {r.status === "revision_requested" ? "Revision needed" : r.status === "rejected" ? "Rejection reason" : "Cancellation reason"}
            </Text>
            <Text className="text-xs text-foreground mt-0.5">{r.decisionReason}</Text>
          </View>
        )}
        {!r.canEdit && r.notes ? <Text className="text-xs text-secondary-foreground">Notes: {r.notes}</Text> : null}
        <View className="flex-row">
          <MessageButton
            projectId={r.project.id}
            contractorId={viewer === "homeowner" ? r.contractor.id : undefined}
            chatPath={(id) => (viewer === "homeowner" ? `/homeowner/messages/${id}` : `/contractor/chat/${id}`)}
            label="Open Project Chat"
          />
        </View>
        <ExportPdfButton label="Export Request PDF" onExport={() => sharePdf(materialRequestPdfHtml(r), `Material request #${r.id}`)} />
      </Card>

      {r.canEdit ? (
        <ItemEditor request={r} onSaved={onChange} />
      ) : (
        <Card title={`Materials (${r.items.length})`} gap={8}>
          {r.items.map((i) => (
            <ReadOnlyItem key={i.id} item={i} />
          ))}
          <TotalRow label={r.confirmedTotal > 0 ? "Confirmed total" : "Estimated total"} value={total} />
        </Card>
      )}

      {r.canEdit && locked.length > 0 && (
        <Card title="Already with suppliers" gap={8}>
          <Text className="text-xs text-muted-foreground">These materials are in progress with a supplier and can&apos;t be changed.</Text>
          {locked.map((i) => (
            <ReadOnlyItem key={i.id} item={i} />
          ))}
        </Card>
      )}

      {r.canDecide && r.approvalFlags.length > 0 && (
        <Card title="Why this needs your decision" gap={8}>
          <Text className="text-xs text-muted-foreground">Everything else in this request is inside your approved plan.</Text>
          {r.approvalFlags.map((flag) => (
            <View key={flag} className="flex-row items-start gap-2 p-3 rounded-xl" style={{ backgroundColor: `${colors.warning}15` }}>
              <Ionicons name="alert-circle-outline" size={16} color={colors.warning} style={{ marginTop: 1 }} />
              <Text className="flex-1 text-xs text-foreground">{flag}</Text>
            </View>
          ))}
        </Card>
      )}

      {r.canDecide && (
        <Card title="Your decision" gap={10}>
          {r.estimateImpact && (
            <View className="p-3 rounded-xl" style={{ backgroundColor: "#ef444415", gap: 4 }}>
              <Text className="text-xs font-semibold" style={{ color: "#ef4444" }}>
                Approving adds {peso(r.estimateImpact.amount)} outside your plan
              </Text>
              <Text className="text-xs text-foreground">
                Your estimate goes from {peso(r.estimateImpact.estimateBefore)} to {peso(r.estimateImpact.estimateAfter)}
                {r.estimateImpact.leftOverAfter !== null && r.estimateImpact.leftOverBefore !== null
                  ? `, and what's left of your budget from ${peso(r.estimateImpact.leftOverBefore)} to ${peso(r.estimateImpact.leftOverAfter)}`
                  : ""}
                .
              </Text>
            </View>
          )}
          <Text className="text-xs text-muted-foreground">
            Approving sends each supplier their own items to confirm stock and final pricing. Nothing is ordered automatically.
          </Text>
          <SubmitButton label={busy ? "Working…" : "Approve Request"} onPress={() => run(() => approveMaterialRequest(r.id))} />
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Button label="Request Revision" variant="tint" color={colors.warning} onPress={() => setReasonFor("revision")} />
            </View>
            <View className="flex-1">
              <Button label="Reject" variant="tint" color="#ef4444" onPress={() => setReasonFor("reject")} />
            </View>
          </View>
        </Card>
      )}

      {r.orders.length > 0 && (
        <Card title="Supplier Fulfilment" gap={10}>
          {r.orders.map((o) => (
            <OrderRow
              key={o.id}
              order={o}
              request={r}
              viewer={viewer}
              busy={busy}
              onConfirmPrices={() => run(() => confirmOrderPrices(o.id))}
              onDeclinePrices={() => setReasonFor({ declineOrder: o.id })}
              onReceive={() => run(() => receiveSupplierOrder(o.id))}
            />
          ))}
        </Card>
      )}

      {error && <Text className="text-xs text-danger px-1">{error}</Text>}

      {canCancel && (
        <Pressable onPress={() => setReasonFor("cancel")} className="items-center py-2">
          <Text className="text-sm font-semibold text-danger">Cancel Request</Text>
        </Pressable>
      )}

      <History request={r} />

      {reasonFor && (
        <ReasonSheet
          title={
            reasonFor === "revision"
              ? "Request Revision"
              : reasonFor === "reject"
                ? "Reject Request"
                : reasonFor === "cancel"
                  ? "Cancel Request"
                  : "Decline Final Prices"
          }
          required={reasonFor !== "cancel"}
          hint={
            reasonFor === "revision"
              ? "Tell the contractor what to change."
              : reasonFor === "cancel"
                ? "Any stock suppliers reserved for this request will be released."
                : typeof reasonFor === "object"
                  ? "That supplier's fulfillment is cancelled and the contractor can choose another supplier."
                  : "The contractor will see this reason."
          }
          onClose={() => setReasonFor(null)}
          onSubmit={async (reason) => {
            const target = reasonFor;
            setReasonFor(null);
            await run(() =>
              target === "revision"
                ? requestMaterialRevision(r.id, reason)
                : target === "reject"
                  ? rejectMaterialRequest(r.id, reason)
                  : target === "cancel"
                    ? cancelMaterialRequest(r.id, reason)
                    : declineOrderPrices(target.declineOrder, reason)
            );
          }}
        />
      )}
    </Screen>
  );
}

function TotalRow({ label, value }: { label: string; value: number }) {
  return (
    <View className="flex-row justify-between items-center pt-1">
      <Text className="text-sm font-semibold text-foreground">{label}</Text>
      <CountUp text={peso(value)} duration={500} className="text-base font-bold text-primary" style={{ fontFamily: MONO }} />
    </View>
  );
}

/** "AI estimated 54 → 66 requested (+22%, includes 10% waste)" — how a line compares with the AI's own estimate. */
function QuantityNote({ item: i }: { item: MaterialRequest["items"][number] }) {
  if (i.aiQuantity === null) {
    return i.planQuantity === null ? <Text className="text-xs" style={{ color: colors.warning }}>Not in the approved plan</Text> : null;
  }
  if (i.quantity === i.aiQuantity) return null;
  const pct = Math.round(((i.quantity - i.aiQuantity) / i.aiQuantity) * 100);
  return (
    <Text className="text-xs" style={{ color: i.planQuantity !== null && i.quantity > i.planQuantity ? "#ef4444" : "#8b5cf6" }}>
      AI estimated {i.aiQuantity.toLocaleString()} → {i.quantity.toLocaleString()} requested ({pct > 0 ? "+" : ""}
      {pct}%{i.wastePct > 0 ? `, includes ${i.wastePct}% waste` : ""})
    </Text>
  );
}

function ReadOnlyItem({ item: i }: { item: MaterialRequest["items"][number] }) {
  return (
    <View className="p-3 rounded-xl bg-muted" style={{ gap: 4 }}>
      <View className="flex-row justify-between gap-2">
        <Text className="flex-1 text-sm font-semibold text-foreground">{i.materialName}</Text>
        <Text className="text-sm font-bold text-foreground" style={{ fontFamily: MONO }}>
          {peso(i.confirmedSubtotal ?? i.estimatedSubtotal)}
        </Text>
      </View>
      <QuantityNote item={i} />
      <Text className="text-xs text-muted-foreground">
        {i.quantity.toLocaleString()} {i.unit} × {peso(i.confirmedUnitPrice ?? i.estimatedUnitPrice)}
        {i.confirmedUnitPrice !== null && i.confirmedUnitPrice !== i.estimatedUnitPrice ? ` (estimate was ${peso(i.estimatedUnitPrice)})` : ""}
      </Text>
      <View className="flex-row flex-wrap items-center gap-2">
        <Text className="text-xs text-muted-foreground">{i.supplierName ?? "No supplier"}</Text>
        <Badge label={i.confirmedUnitPrice !== null ? "Confirmed price" : "Estimated price"} color={i.confirmedUnitPrice !== null ? "#10b981" : "#6b7280"} />
        <ItemStatusBadge status={i.status} />
      </View>
    </View>
  );
}

function OrderRow({
  order: o,
  request: r,
  viewer,
  busy,
  onConfirmPrices,
  onDeclinePrices,
  onReceive,
}: {
  order: MaterialRequestOrder;
  request: MaterialRequest;
  viewer: Viewer;
  busy: boolean;
  onConfirmPrices: () => void;
  onDeclinePrices: () => void;
  onReceive: () => void;
}) {
  const items = r.items.filter((i) => o.itemIds.includes(i.id));
  const estimate = items.reduce((s, i) => s + i.estimatedSubtotal, 0);
  return (
    <View className="p-3 rounded-xl bg-muted" style={{ gap: 6 }}>
      <View className="flex-row justify-between items-start gap-2">
        <Text className="flex-1 text-sm font-semibold text-foreground">{o.supplierName ?? "Supplier"}</Text>
        <OrderStatusBadge status={o.status} />
      </View>
      <Text className="text-xs text-muted-foreground" numberOfLines={2}>
        {items.map((i) => `${i.materialName} × ${i.quantity.toLocaleString()}`).join(" · ") || "Items moved back for revision"}
      </Text>
      {o.confirmedTotal > 0 && (
        <Text className="text-xs text-foreground">
          Final total <Text style={{ fontFamily: MONO }}>{peso(o.confirmedTotal)}</Text>
          {o.priceChanged ? ` (estimate ${peso(estimate)})` : ""}
        </Text>
      )}
      {o.expectedDeliveryDate && <Text className="text-xs text-muted-foreground">Expected delivery {o.expectedDeliveryDate}</Text>}
      {o.supplierNote ? <Text className="text-xs text-muted-foreground">Supplier note: {o.supplierNote}</Text> : null}
      {o.declineReason && ["unavailable", "cancelled"].includes(o.status) ? <Text className="text-xs text-danger">{o.declineReason}</Text> : null}

      {viewer === "homeowner" && o.status === "awaiting_homeowner_confirmation" && (
        <View style={{ gap: 8 }}>
          <Text className="text-xs" style={{ color: colors.warning }}>
            The supplier&apos;s final prices differ from the estimate. Accept them to confirm the order with the supplier.
          </Text>
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Button label={busy ? "…" : "Accept Final Prices"} onPress={onConfirmPrices} />
            </View>
            <View className="flex-1">
              <Button label="Decline" variant="tint" color="#ef4444" onPress={onDeclinePrices} />
            </View>
          </View>
        </View>
      )}
      {viewer === "contractor" && o.status === "confirmed" && (
        <Button label={busy ? "…" : "Confirm Receipt"} onPress={onReceive} />
      )}
    </View>
  );
}

function History({ request: r }: { request: MaterialRequest }) {
  const { chrome } = useTheme();
  const [open, setOpen] = useState(false);
  const supplierName = (orderId: number | null) => r.orders.find((o) => o.id === orderId)?.supplierName;
  const entries = [...r.history].reverse();
  return (
    <Card>
      <Pressable onPress={() => setOpen((v) => !v)} className="flex-row items-center justify-between">
        <Text className="font-bold text-sm text-foreground">Status History ({entries.length})</Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={chrome.mutedForeground} />
      </Pressable>
      {open && (
        <View className="mt-3" style={{ gap: 10 }}>
          {entries.map((h) => (
            <View key={h.id} className="flex-row gap-3">
              <View className="w-2 h-2 rounded-full mt-1.5" style={{ backgroundColor: "#f59e0b" }} />
              <View className="flex-1">
                <Text className="text-xs font-semibold text-foreground">
                  {h.orderId ? `${supplierName(h.orderId) ?? "Supplier"}: ` : ""}
                  {statusLabel(h.newStatus)}
                </Text>
                <Text className="text-xs text-muted-foreground">
                  {h.by ?? "System"}
                  {h.at ? ` · ${formatDateTime(h.at)}` : ""}
                </Text>
                {h.reason ? <Text className="text-xs text-secondary-foreground mt-0.5">{h.reason}</Text> : null}
              </View>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

/** Contractor's editor for a draft / revision: catalog search, AI import, quantities, save, submit. */
function ItemEditor({ request: r, onSaved }: { request: MaterialRequest; onSaved: (r: MaterialRequest) => void }) {
  const [items, setItems] = useState<DraftItem[]>(() => toDraftItems(r));
  const [notes, setNotes] = useState(r.notes ?? "");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<null | "save" | "submit">(null);
  const [error, setError] = useState<string | null>(null);
  const [picker, setPicker] = useState<null | { replaceKey?: string; search: string }>(null);
  const [importing, setImporting] = useState(false);
  // Set when Submit found materials without a listing: the picker then walks through each of them in turn.
  const [guided, setGuided] = useState(false);

  const update = (next: DraftItem[]) => {
    setItems(next);
    setDirty(true);
  };
  const missing = items.filter((d) => !d.supplierProductId);
  const lockedTotal = r.items.filter((i) => i.locked).reduce((s, i) => s + i.estimatedSubtotal, 0);
  const total = lockedTotal + items.reduce((s, d) => s + (Number(d.quantity) || 0) * d.unitPrice, 0);

  const validate = (): string | null => {
    for (const d of items) {
      if (!WHOLE.test(d.quantity) || Number(d.quantity) < 1) return `Enter a quantity of at least 1 for ${d.materialName}.`;
    }
    return null;
  };

  const save = async (andSubmit: boolean) => {
    if (busy) return;
    const problem = validate();
    if (problem) return setError(problem);
    if (andSubmit && missing.length > 0) {
      // Don't just refuse: open the picker on the first one, searching for what the AI called it.
      setError(`${missing.length} material${missing.length === 1 ? " still needs" : "s still need"} a supplier listing — pick one for each, or remove it.`);
      setGuided(true);
      return setPicker({ replaceKey: missing[0].key, search: missing[0].materialName });
    }
    setBusy(andSubmit ? "submit" : "save");
    setError(null);
    try {
      let saved = await saveMaterialRequest(r.id, notes, items.map(toInput));
      if (andSubmit) saved = await submitMaterialRequest(r.id);
      setDirty(false);
      onSaved(saved);
    } catch (err) {
      setError(errorMessage(err, "Could not save the request."));
    } finally {
      setBusy(null);
    }
  };

  const onPick = (m: CatalogMaterialDto) => {
    const replaceKey = picker?.replaceKey;
    const next = replaceKey
      ? items.map((d) => (d.key === replaceKey ? fromListing(m, d.quantity, d.source, d.key, d.id) : d))
      : [...items, fromListing(m, "1", "manual")];
    update(next);

    const stillMissing = next.find((d) => !d.supplierProductId);
    if (guided && stillMissing) {
      setPicker({ replaceKey: stillMissing.key, search: stillMissing.materialName });
      return;
    }
    setPicker(null);
    if (guided) {
      setGuided(false);
      setError(null);
    }
  };

  const closePicker = () => {
    setPicker(null);
    setGuided(false);
  };

  const onImport = (picked: AiMaterialSuggestion[]) => {
    setImporting(false);
    const imported: DraftItem[] = picked.map((s) =>
      s.match
        ? {
            key: newKey(),
            supplierProductId: s.match.supplierProductId,
            supplierName: s.match.supplierName,
            materialName: s.match.name,
            unit: s.match.unit,
            quantity: String(s.quantity),
            unitPrice: s.match.price,
            availableQuantity: s.match.availableQuantity,
            source: "ai",
            aiQuantity: null,
            planQuantity: null,
            similarTo: s.matchKind === "similar" ? s.material : undefined,
          }
        : {
            key: newKey(),
            supplierProductId: null,
            supplierName: null,
            materialName: s.material,
            unit: s.unit,
            quantity: String(s.quantity),
            unitPrice: s.estimatedUnitPrice,
            availableQuantity: null,
            source: "ai",
            aiQuantity: null,
            planQuantity: null,
          }
    );
    update([...items, ...imported]);
  };

  return (
    <>
      <Card title={`Materials (${items.length})`} gap={10}>
        {items.length === 0 && (
          <Text className="text-xs text-muted-foreground">Add materials from supplier inventories, or import the AI plan&apos;s estimate.</Text>
        )}
        {items.map((d) => {
          const qty = Number(d.quantity) || 0;
          const short = d.availableQuantity !== null && qty > d.availableQuantity;
          return (
            <View key={d.key} className="p-3 rounded-xl bg-muted" style={{ gap: 6 }}>
              <View className="flex-row justify-between gap-2">
                <Text className="flex-1 text-sm font-semibold text-foreground">{d.materialName}</Text>
                <Pressable onPress={() => update(items.filter((x) => x.key !== d.key))} hitSlop={8} accessibilityLabel={`Remove ${d.materialName}`}>
                  <Ionicons name="trash-outline" size={16} color="#ef4444" />
                </Pressable>
              </View>
              <View className="flex-row flex-wrap items-center gap-2">
                {d.supplierProductId ? (
                  <>
                    <Text className="text-xs text-muted-foreground">{d.supplierName}</Text>
                    {d.availableQuantity !== null && (
                      <StockBadge status={d.availableQuantity > 0 ? "in_stock" : "out_of_stock"} quantity={d.availableQuantity} unit={d.unit} />
                    )}
                  </>
                ) : (
                  <Badge label="No supplier selected" color={colors.warning} />
                )}
                {d.source === "ai" && <Badge label="AI suggested" color="#8b5cf6" />}
              </View>
              {d.similarTo && (
                <Text className="text-xs" style={{ color: "#3b82f6" }}>
                  Closest listing to the AI&apos;s “{d.similarTo}” — check it&apos;s the right one, or change it.
                </Text>
              )}
              {d.planQuantity !== null && qty > d.planQuantity ? (
                <Text className="text-xs" style={{ color: colors.warning }}>
                  Above the plan&apos;s {d.planQuantity.toLocaleString()} {d.unit} — the homeowner will be asked to approve.
                </Text>
              ) : d.aiQuantity !== null && qty !== d.aiQuantity ? (
                <Text className="text-xs" style={{ color: "#8b5cf6" }}>
                  AI estimated {d.aiQuantity.toLocaleString()} {d.unit}.
                </Text>
              ) : null}
              {short && (
                <View className="flex-row items-center gap-1.5">
                  <Ionicons name="warning-outline" size={14} color="#ef4444" />
                  <Text className="text-xs text-danger">
                    Insufficient Stock — only {d.availableQuantity?.toLocaleString()} {d.unit} available from this supplier.
                  </Text>
                </View>
              )}
              <View className="flex-row items-end gap-3">
                <View style={{ width: 110 }}>
                  <Field
                    label={`Qty (${d.unit})`}
                    value={d.quantity}
                    onChangeText={(v) => update(items.map((x) => (x.key === d.key ? { ...x, quantity: v } : x)))}
                    keyboardType="number-pad"
                  />
                </View>
                <View className="flex-1 items-end pb-2">
                  <Text className="text-xs text-muted-foreground">
                    × {peso(d.unitPrice)} {d.supplierProductId ? "supplier price" : "AI estimate"}
                  </Text>
                  <Text className="text-sm font-bold text-foreground" style={{ fontFamily: MONO }}>
                    {peso(qty * d.unitPrice)}
                  </Text>
                </View>
              </View>
              <Pressable onPress={() => setPicker({ replaceKey: d.key, search: d.materialName })}>
                <Text className="text-xs font-semibold text-primary">{d.supplierProductId ? "Change supplier / material" : "Choose a supplier listing →"}</Text>
              </Pressable>
            </View>
          );
        })}
        <View className="flex-row flex-wrap gap-2">
          <Button label="+ Add from Supplier Catalog" onPress={() => setPicker({ search: "" })} />
          <Button label="Import AI Estimate" variant="tint" color="#8b5cf6" onPress={() => setImporting(true)} />
        </View>
        <TotalRow label="Estimated total" value={total} />
        {missing.length > 0 && (
          <Text className="text-xs" style={{ color: colors.warning }}>
            {missing.length} material{missing.length === 1 ? " has" : "s have"} no supplier listing yet. Tap Submit and you&apos;ll be taken through them one by one.
          </Text>
        )}
        <Text className="text-xs text-muted-foreground">Prices are current supplier list prices. Suppliers confirm final prices after approval.</Text>
      </Card>

      <Card gap={10}>
        <Field
          label="Additional notes"
          value={notes}
          onChangeText={(v) => {
            setNotes(v);
            setDirty(true);
          }}
          multiline
          maxLength={2000}
          placeholder="Delivery schedule, site access, specs…"
        />
        {error && <Text className="text-xs text-danger">{error}</Text>}
        <SubmitButton label={busy === "submit" ? "Submitting…" : "Submit for Homeowner Approval"} onPress={() => save(true)} />
        <Button label={busy === "save" ? "Saving…" : dirty ? "Save Draft" : "Saved"} variant="muted" onPress={() => save(false)} />
      </Card>

      {picker && (
        <CatalogPickerSheet
          key={picker.replaceKey ?? "new"}
          initialSearch={picker.search}
          forMaterial={picker.replaceKey ? items.find((d) => d.key === picker.replaceKey)?.materialName : undefined}
          onPick={onPick}
          onClose={closePicker}
        />
      )}
      {importing && <AiImportSheet projectId={r.project.id} onImport={onImport} onClose={() => setImporting(false)} />}
    </>
  );
}

/** Search every supplier's listed materials and pick one. */
function CatalogPickerSheet({
  initialSearch,
  forMaterial,
  onPick,
  onClose,
}: {
  initialSearch: string;
  /** The material a listing is being chosen for, when replacing one. */
  forMaterial?: string;
  onPick: (m: CatalogMaterialDto) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState(initialSearch);
  const [results, setResults] = useState<CatalogMaterialDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    const id = ++requestId.current;
    const t = setTimeout(() => {
      fetchMaterialCatalog({ search })
        .then((list) => {
          if (id === requestId.current) {
            setResults(list);
            setError(null);
          }
        })
        .catch((err) => {
          if (id === requestId.current) setError(errorMessage(err, "Could not search materials."));
        });
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  return (
    <Sheet
      visible
      title="Supplier Materials"
      subtitle={forMaterial ? `Pick the listing for “${forMaterial}” — its supplier and current price are used.` : "Pick a listing — its supplier and current price are used."}
      onClose={onClose}
    >
      <Field label="Search" value={search} onChangeText={setSearch} placeholder="e.g. cement, rebar, plywood" maxLength={100} />
      {error && <Text className="text-xs text-danger">{error}</Text>}
      {results === null && !error ? (
        <ActivityIndicator color="#f59e0b" />
      ) : results?.length === 0 ? (
        <Text className="text-sm text-muted-foreground">No listed materials match.</Text>
      ) : (
        results?.map((m) => (
          <Pressable key={m.id} onPress={() => onPick(m)} className="p-3 rounded-xl bg-muted" style={{ gap: 4 }}>
            <View className="flex-row justify-between gap-2">
              <Text className="flex-1 text-sm font-semibold text-foreground">{m.name}</Text>
              <Text className="text-sm font-bold text-primary" style={{ fontFamily: MONO }}>
                {peso(m.price)}/{m.unit}
              </Text>
            </View>
            <View className="flex-row flex-wrap items-center gap-2">
              <Text className="text-xs text-muted-foreground">{m.supplier.business_name || m.supplier.name}</Text>
              <StockBadge status={m.stock_status} quantity={m.available_quantity} unit={m.unit} />
            </View>
          </Pressable>
        ))
      )}
    </Sheet>
  );
}

/** The project's saved AI material estimate; exact-name matches come pre-linked to a supplier listing. */
function AiImportSheet({ projectId, onImport, onClose }: { projectId: number; onImport: (s: AiMaterialSuggestion[]) => void; onClose: () => void }) {
  const { chrome } = useTheme();
  const [suggestions, setSuggestions] = useState<AiMaterialSuggestion[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAiMaterials(projectId)
      .then((list) => {
        setSuggestions(list);
        setSelected(new Set(list.map((_, i) => i)));
      })
      .catch((err) => setError(errorMessage(err, "Could not load the AI estimate.")));
  }, [projectId]);

  const toggle = (i: number) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <Sheet visible title="Import AI Estimate" subtitle="Suggestions only — edit quantities and suppliers before submitting." onClose={onClose}>
      {error && <Text className="text-xs text-danger">{error}</Text>}
      {suggestions === null && !error ? (
        <ActivityIndicator color="#f59e0b" />
      ) : suggestions?.length === 0 ? (
        <Text className="text-sm text-muted-foreground">
          This project has no saved AI material estimate. (Only projects created from the AI planner include one.)
        </Text>
      ) : (
        <>
          {suggestions?.map((s, i) => (
            <Pressable key={`${s.material}-${i}`} onPress={() => toggle(i)} className="flex-row items-start gap-3 p-3 rounded-xl bg-muted">
              <Ionicons name={selected.has(i) ? "checkbox" : "square-outline"} size={20} color={selected.has(i) ? "#f59e0b" : chrome.mutedForeground} />
              <View className="flex-1" style={{ gap: 3 }}>
                <Text className="text-sm font-semibold text-foreground">{s.material}</Text>
                <Text className="text-xs text-muted-foreground">
                  {s.quantity.toLocaleString()} {s.unit} · AI estimate {peso(s.estimatedUnitPrice)}/{s.unit}
                </Text>
                {s.match ? (
                  <>
                    <View className="flex-row flex-wrap items-center gap-2">
                      <Badge
                        label={`${s.matchKind === "similar" ? "Closest" : "Matched"}: ${s.match.supplierName ?? "supplier"} ${peso(s.match.price)}`}
                        color={s.matchKind === "similar" ? "#3b82f6" : "#10b981"}
                      />
                      <StockBadge status={s.match.stockStatus} quantity={s.match.availableQuantity} unit={s.match.unit} />
                    </View>
                    {s.matchKind === "similar" && <Text className="text-xs text-muted-foreground">{s.match.name} — check it&apos;s the right one.</Text>}
                  </>
                ) : (
                  <Badge label="No listing found — you'll pick one when you submit" color={colors.warning} />
                )}
              </View>
            </Pressable>
          ))}
          <SubmitButton
            label={`Import ${selected.size} item${selected.size === 1 ? "" : "s"}`}
            onPress={() => onImport((suggestions ?? []).filter((_, i) => selected.has(i)))}
          />
        </>
      )}
    </Sheet>
  );
}

/** Collects a decision reason (required unless `required` is false). */
function ReasonSheet({
  title,
  hint,
  required,
  onClose,
  onSubmit,
}: {
  title: string;
  hint: string;
  required: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <Sheet visible title={title} subtitle={hint} onClose={onClose}>
      <Field label={required ? "Reason *" : "Reason (optional)"} value={reason} onChangeText={setReason} multiline maxLength={1000} />
      {error && <Text className="text-xs text-danger">{error}</Text>}
      <SubmitButton
        label={title}
        onPress={() => {
          if (required && !reason.trim()) return setError("Please give a reason.");
          onSubmit(reason.trim());
        }}
      />
    </Sheet>
  );
}
