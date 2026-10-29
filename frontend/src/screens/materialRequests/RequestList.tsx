import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Badge, Button, Card, ChipPicker, MONO, PageHeader, Screen } from "@/components/ui";
import Sheet from "@/components/Sheet";
import { RequestStatusBadge } from "@/components/MaterialStatusBadge";
import { createMaterialRequest, fetchMaterialRequests } from "@/services/api/materialRequests";
import { fetchMyProjects } from "@/services/api/projects";
import type { MaterialRequest } from "@/types/materialRequest";
import type { MyProject } from "@/types/project";
import { peso } from "@/utils/currency";

type Viewer = "contractor" | "homeowner";

/** What needs this viewer's attention right now. */
function needsAction(r: MaterialRequest, viewer: Viewer): boolean {
  if (viewer === "homeowner") {
    return r.status === "pending_homeowner_approval" || r.orders.some((o) => o.status === "awaiting_homeowner_confirmation");
  }
  return r.status === "draft" || r.status === "revision_requested" || r.orders.some((o) => o.status === "delivered");
}

const FILTERS: Record<string, (r: MaterialRequest, v: Viewer) => boolean> = {
  "Needs Action": needsAction,
  "In Progress": (r) => r.status === "approved" || r.status === "pending_homeowner_approval",
  Completed: (r) => r.status === "completed",
  Closed: (r) => r.status === "rejected" || r.status === "cancelled",
  All: () => true,
};

const formatDate = (iso: string) => new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });

/**
 * Material requests for the viewer: a contractor's own requests ("My Material Requests"), or a
 * homeowner's submitted requests to approve ("Material Approvals"). `detailPath` is the role's route.
 */
export default function RequestList({
  viewer,
  detailPath,
  topInset = true,
}: {
  viewer: Viewer;
  detailPath: (id: number) => string;
  topInset?: boolean;
}) {
  const [requests, setRequests] = useState<MaterialRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("Needs Action");
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    fetchMaterialRequests()
      .then((list) => {
        setRequests(list);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load material requests."));
  }, []);

  useFocusEffect(load);

  const list = requests ?? [];
  const counts = Object.fromEntries(Object.entries(FILTERS).map(([k, f]) => [k, list.filter((r) => f(r, viewer)).length]));
  const shown = list.filter((r) => FILTERS[filter](r, viewer));

  return (
    <Screen topInset={topInset}>
      <PageHeader
        title={viewer === "homeowner" ? "Material Approvals" : "Material Requests"}
        subtitle={
          viewer === "homeowner"
            ? "Review your contractor's material requests and track deliveries."
            : "Prepare material lists, send them for approval and track supplier fulfilment."
        }
      />

      {viewer === "contractor" && (
        <View className="flex-row">
          <Button label="+ Create Material Request" onPress={() => setCreating(true)} />
        </View>
      )}

      <ChipPicker
        label="Show"
        options={Object.keys(FILTERS).map((k) => `${k} (${counts[k]})`)}
        value={`${filter} (${counts[filter]})`}
        onChange={(v) => setFilter(v.replace(/ \(\d+\)$/, ""))}
      />

      {error ? (
        <Card gap={10}>
          <Text className="text-xs text-danger">{error}</Text>
          <View className="flex-row">
            <Button label="Try Again" variant="muted" onPress={load} />
          </View>
        </Card>
      ) : requests === null ? (
        <View className="items-center py-10">
          <ActivityIndicator color="#f59e0b" />
        </View>
      ) : shown.length === 0 ? (
        <Card>
          <Text className="text-sm text-center text-muted-foreground py-6">
            {list.length > 0
              ? "Nothing in this view."
              : viewer === "homeowner"
                ? "No material requests yet. Your contractor's submitted requests will appear here for approval."
                : "No material requests yet. Create one for a project you're assigned to."}
          </Text>
        </Card>
      ) : (
        shown.map((r) => <RequestCard key={r.id} request={r} viewer={viewer} onPress={() => router.push(detailPath(r.id) as never)} />)
      )}

      {creating && <CreateSheet onClose={() => setCreating(false)} detailPath={detailPath} />}
    </Screen>
  );
}

function RequestCard({ request: r, viewer, onPress }: { request: MaterialRequest; viewer: Viewer; onPress: () => void }) {
  const action = needsAction(r, viewer);
  const total = r.confirmedTotal > 0 ? r.confirmedTotal : r.estimatedTotal;
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <Card gap={8}>
        <View className="flex-row justify-between items-start gap-3">
          <View className="flex-1 gap-1">
            <Text className="text-sm font-bold text-foreground">{r.project.title}</Text>
            <Text className="text-xs text-muted-foreground">
              #{r.id} · {viewer === "homeowner" ? `Contractor ${r.contractor.name}` : `Homeowner ${r.homeowner.name}`} ·{" "}
              {formatDate(r.submittedAt ?? r.createdAt)}
            </Text>
            <View className="flex-row flex-wrap gap-2 mt-1">
              <RequestStatusBadge status={r.status} />
              {action && <Badge label="Action needed" color="#ef4444" />}
            </View>
          </View>
          <View className="items-end">
            <Text className="text-base font-bold text-primary" style={{ fontFamily: MONO }}>
              {peso(total)}
            </Text>
            <Text className="text-xs text-muted-foreground">{r.confirmedTotal > 0 ? "confirmed" : "estimated"}</Text>
          </View>
        </View>
        <Text className="text-xs text-secondary-foreground" numberOfLines={2}>
          {r.items.length === 0
            ? "No materials yet"
            : r.items.map((i) => `${i.materialName} × ${i.quantity.toLocaleString()}`).join(" · ")}
        </Text>
      </Card>
    </Pressable>
  );
}

/** Contractor picks one of their assigned projects; a draft is created and opened. */
function CreateSheet({ onClose, detailPath }: { onClose: () => void; detailPath: (id: number) => string }) {
  const [projects, setProjects] = useState<MyProject[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    fetchMyProjects()
      .then(setProjects)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load projects."));
  }, []);

  const create = (projectId: number) => {
    if (busyId) return;
    setBusyId(projectId);
    createMaterialRequest(projectId)
      .then((r) => {
        onClose();
        router.push(detailPath(r.id) as never);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Could not create the request.");
        setBusyId(null);
      });
  };

  return (
    <Sheet visible title="Create Material Request" subtitle="Choose the project these materials are for." onClose={onClose}>
      {error && <Text className="text-xs text-danger">{error}</Text>}
      {projects === null && !error ? (
        <ActivityIndicator color="#f59e0b" />
      ) : projects?.length === 0 ? (
        <Text className="text-sm text-muted-foreground">You aren&apos;t assigned to any project yet.</Text>
      ) : (
        projects?.map((p) => (
          <Pressable key={p.id} onPress={() => create(p.id)} className="p-3 rounded-xl bg-muted flex-row items-center justify-between gap-3">
            <View className="flex-1">
              <Text className="text-sm font-semibold text-foreground">{p.title}</Text>
              <Text className="text-xs text-muted-foreground">
                Homeowner {p.ownerName}
                {p.location ? ` · ${p.location}` : ""}
              </Text>
            </View>
            {busyId === p.id ? <ActivityIndicator color="#f59e0b" /> : <Text className="text-xs font-semibold text-primary">Select</Text>}
          </Pressable>
        ))
      )}
    </Sheet>
  );
}
