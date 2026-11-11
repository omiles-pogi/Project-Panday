import { ActivityIndicator, Text, View } from "react-native";
import { usePlan } from "@/context/PlanContext";
import ProjectChat from "@/screens/homeowner/ProjectChat";

export default function ProjectChatRoute() {
  const { ready, activeProjectKey, error } = usePlan();
  if (!ready) return <View className="flex-1 items-center justify-center bg-background p-4">
    {error ? <Text className="text-secondary-foreground text-center">{error}</Text> : <ActivityIndicator accessibilityLabel="Loading project conversation" />}
  </View>;
  // Recreate only local UI on a project switch; all saved conversations remain in PlanContext.
  return <ProjectChat key={activeProjectKey} />;
}
