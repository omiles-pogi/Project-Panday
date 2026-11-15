import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { usePlan } from "@/context/PlanContext";

/** Keep chat/keyboard hooks mounted, but never reveal a cached project before lifecycle validation. */
export default function ActiveProjectGate({ children }: { children: ReactNode }) {
  const { ready, activeProjectKey, projectSelectionError, error, refreshProjectSelection } = usePlan();
  const message = projectSelectionError || error;
  return <View className="flex-1 bg-background">
    {/* Reset screen-local records/forms on a project switch, but keep them mounted during revalidation. */}
    <View key={activeProjectKey} style={{ flex: 1, display: ready ? "flex" : "none" }} accessibilityElementsHidden={!ready} importantForAccessibility={ready ? "auto" : "no-hide-descendants"}>
      {children}
    </View>
    {!ready && <View className="flex-1 items-center justify-center p-6" style={{ gap: 16 }}>
      {message ? <Text className="text-secondary-foreground text-center">{message}</Text> : <ActivityIndicator accessibilityLabel="Checking active project" color="#f59e0b" />}
      {projectSelectionError && <Pressable accessibilityRole="button" onPress={() => void refreshProjectSelection()} className="rounded-xl bg-primary px-5 py-3">
        <Text className="font-semibold text-primary-foreground">Retry</Text>
      </Pressable>}
    </View>}
  </View>;
}
