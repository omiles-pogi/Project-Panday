import { Redirect, useLocalSearchParams } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import ProjectOverview from "@/screens/homeowner/ProjectOverview";

/** Details mount only for an explicit project link; opening Home never mounts this component. */
export default function ProjectOverviewRoute() {
  const { projectId } = useLocalSearchParams<{ projectId?: string }>();
  const { user } = useAuth();
  const id = Number(projectId);
  if (user?.role !== "homeowner") return <Redirect href="/" />;
  if (!Number.isSafeInteger(id) || id < 1) return <Redirect href="/homeowner" />;
  return <ProjectOverview key={id} />;
}
