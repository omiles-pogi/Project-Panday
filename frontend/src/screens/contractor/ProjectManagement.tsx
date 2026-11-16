import { useLocalSearchParams } from "expo-router";
import ContractorProjectDetails from "@/screens/contractor/ProjectDetails";
import OngoingProjects from "@/screens/contractor/OngoingProjects";

export default function ProjectManagement() {
  const { projectId } = useLocalSearchParams<{ projectId?: string }>();
  // Preserve existing Dashboard and notification deep links without changing the main header.
  if (projectId !== undefined) {
    const selected = typeof projectId === "string" && /^[1-9]\d*$/.test(projectId) ? Number(projectId) : NaN;
    return <ContractorProjectDetails key={String(selected)} projectId={selected} />;
  }
  return <OngoingProjects />;
}
