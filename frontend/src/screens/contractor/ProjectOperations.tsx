import { useState } from "react";
import { Text, View, Pressable, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "@/components/ui";
import MessageButton from "@/components/MessageButton";
import ProjectStatusBanner from "@/components/ProjectStatusBanner";
import TeamActivity from "@/components/TeamActivity";
import { setTeamWage } from "@/services/api/projects";
import { createMaterialRequest } from "@/services/api/materialRequests";
import WageSheet from "@/components/WageSheet";
import type { MyProject, Wage, WageInput } from "@/types/project";
import { peso } from "@/utils/currency";
import { wageLine } from "@/utils/wage";

/** Starts a draft material request for this project and opens it in the editor. */
function CreateMaterialRequestButton({ projectId }: { projectId: number }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    createMaterialRequest(projectId)
      .then((r) => router.push(`/contractor/material-request/${r.id}` as never))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not create the request."))
      .finally(() => setBusy(false));
  };

  return (
    <View style={{ gap: 4 }}>
      <Pressable onPress={create} className="flex-row items-center gap-1.5 px-4 py-2.5 rounded-xl" style={{ backgroundColor: "#f59e0b20" }}>
        {busy ? <ActivityIndicator size="small" color="#f59e0b" /> : <Ionicons name="clipboard-outline" size={16} color="#f59e0b" />}
        <Text className="text-xs font-semibold" style={{ color: "#f59e0b" }}>
          Create Material Request
        </Text>
      </Pressable>
      {error && <Text className="text-xs text-danger">{error}</Text>}
    </View>
  );
}

export default function ContractorProjectOperations({
  project,
  onChanged,
  readOnly = false,
}: {
  project: MyProject;
  onChanged: () => Promise<void>;
  readOnly?: boolean;
}) {
  // The worker whose wage is being set, if any.
  const [wageTarget, setWageTarget] = useState<{ id: number; name: string; wage: Wage | null | undefined; minDailyWage?: number | null } | null>(null);

  const saveWage = async (input: WageInput) => {
    if (!wageTarget || readOnly || project.status !== "active" || !project.canManageChecklist) return;
    await setTeamWage(project.id, "worker", wageTarget.id, input);
    onChanged();
  };

  return (
    <Card>
      <View className="mt-2">
        <ProjectStatusBanner project={project} />
      </View>

      <View className="mt-2 flex-row flex-wrap gap-2">
        <MessageButton projectId={project.id} chatPath={(id) => `/contractor/chat/${id}`} label="Message Homeowner" />
        {project.workers.map((worker) => (
          <MessageButton
            key={worker.id}
            projectId={project.id}
            workerId={worker.id}
            chatPath={(id) => `/contractor/chat/${id}`}
            label={`Message ${worker.name}`}
          />
        ))}
        {!readOnly && project.status === "active" && <CreateMaterialRequestButton projectId={project.id} />}
      </View>

      {(project.myWage || project.workers.length > 0) && (
        <View className="mt-3" style={{ gap: 6 }}>
          <Text className="text-xs font-bold text-foreground">Wages</Text>
          <Text className="text-xs leading-5 text-muted-foreground">Worker wages are calculated automatically when they join. Custom amounts are optional.</Text>
          <View className="flex-row items-center justify-between px-3 py-2 rounded-xl bg-muted">
            <Text className="text-xs font-medium text-foreground">Your fee</Text>
            <Text className="text-xs font-semibold" style={{ color: project.myWage ? "#10b981" : "#6b7280" }}>
              {project.myWage ? wageLine(project.myWage) : "Not set — agreed with the homeowner"}
            </Text>
          </View>
          {project.workers.map((worker) => (
            <View key={worker.id} className="flex-row items-center gap-2 px-3 py-2 rounded-xl bg-muted">
              <View className="flex-1">
                <Text className="text-xs font-medium text-foreground">{worker.name}</Text>
                <Text className="text-xs" style={{ color: worker.wage ? "#10b981" : "#6b7280" }}>
                  {wageLine(worker.wage)}
                </Text>
                {worker.minDailyWage != null && (
                  <Text className="text-xs text-muted-foreground">Asks from {peso(worker.minDailyWage)}/day</Text>
                )}
              </View>
              {!readOnly && project.canManageChecklist && project.status === "active" && (
                <Pressable
                  onPress={() => setWageTarget({ id: worker.id, name: worker.name, wage: worker.wage, minDailyWage: worker.minDailyWage })}
                  hitSlop={6}
                  className="px-2.5 py-1.5 rounded-lg"
                  style={{ backgroundColor: "#f59e0b20" }}
                >
                  <Text className="text-xs font-semibold" style={{ color: "#f59e0b" }}>
                    {worker.wage ? "Wage options" : "Auto wage"}
                  </Text>
                </Pressable>
              )}
            </View>
          ))}
        </View>
      )}

      {wageTarget && !readOnly && project.status === "active" && (
        <WageSheet
          name={wageTarget.name}
          current={wageTarget.wage}
          defaultUnit="per_day"
          minDailyWage={wageTarget.minDailyWage}
          onClose={() => setWageTarget(null)}
          onSave={saveWage}
        />
      )}

      {project.workers.length > 0 && (
        <View style={{ gap: 6 }} className="mt-2">
          <Text className="text-xs font-bold text-foreground">Team on site</Text>
          <TeamActivity projectId={project.id} />
        </View>
      )}
    </Card>
  );
}
