import { useState } from "react";
import { Alert, Text, View } from "react-native";
import { router } from "expo-router";
import { usePlan } from "@/context/PlanContext";
import { useTheme } from "@/context/ThemeContext";
import { useNewProjectFlow } from "@/hooks/useNewProjectFlow";
import { Action, WorkersSectionTitle } from "./WorkersTabUI";

export const PROJECT_REQUIRED = "Create or continue a project with PandAI before inviting workers.";

/** Browsing never creates a project. Only this deliberate action enters the existing
 * draft flow, which resumes saved conversations and reuses server placeholders. */
export function useHiringProjectPrompt() {
  const { ready, activeProjectKey, planningSessions, planningSessionsReady, resumePlanningSession, projectSelectionError, refreshProjectSelection } = usePlan();
  const creation = useNewProjectFlow([]);
  const [notice, setNotice] = useState(false);
  const sessions = planningSessions ?? [];
  const hasSelectedProject = /^[1-9]\d*$/.test(activeProjectKey);
  const session = sessions.find(item => item.key === activeProjectKey) ?? (!hasSelectedProject ? sessions[0] : undefined);
  const label = session || hasSelectedProject ? "Continue Project" : "Start a Project";
  const disabled = !ready || !planningSessionsReady || creation.creatingProject;
  const start = () => {
    if (disabled) return;
    if (session) {
      if (resumePlanningSession(session.key)) router.push("/homeowner/project-chat" as never);
    } else if (hasSelectedProject) router.push("/homeowner/project-chat" as never);
    else creation.requestNewProject();
  };
  const requireProject = () => {
    setNotice(true);
    Alert.alert("Project required", PROJECT_REQUIRED, [
      { text: "Cancel", style: "cancel" },
      ...(!disabled ? [{ text: label, onPress: start }] : []),
    ]);
  };
  return { label, disabled, start, requireProject, notice, error: projectSelectionError || creation.createError, refreshProjectSelection };
}

export default function ProjectHiringPrompt({ flow }: { flow: ReturnType<typeof useHiringProjectPrompt> }) {
  const { chrome } = useTheme();
  return <View style={{ backgroundColor: chrome.card, borderColor: chrome.border, borderWidth: 1, borderRadius: 18, padding: 14, gap: 10 }}>
    <WorkersSectionTitle>Start Your Project</WorkersSectionTitle>
    <Text style={{ color: chrome.secondaryForeground, fontSize: 12, lineHeight: 18 }}>Ready to build your team? Create a construction project with PandAI to invite and hire workers.</Text>
    {flow.notice && <Text accessibilityRole="alert" style={{ color: chrome.foreground, fontSize: 12, lineHeight: 18 }}>{PROJECT_REQUIRED}</Text>}
    <Action label={flow.label} filled disabled={flow.disabled} onPress={flow.start} />
    {flow.error && <><Text accessibilityRole="alert" style={{ color: "#ef4444", fontSize: 12 }}>{flow.error}</Text><Action label="Retry project selection" onPress={() => void flow.refreshProjectSelection()} /></>}
  </View>;
}
