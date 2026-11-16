import { useLocalSearchParams } from "expo-router";
import WorkerProjectDetails from "@/screens/worker/ProjectDetails";

export default function WorkerCompletedProject() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const projectId = typeof id === "string" && /^[1-9]\d*$/.test(id) ? Number(id) : NaN;
  return <WorkerProjectDetails key={String(projectId)} projectId={projectId} history />;
}
