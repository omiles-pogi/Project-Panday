import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import HomeownerHeader from "@/components/HomeownerHeader";
import WorkerProjectDetails from "@/screens/worker/ProjectDetails";

export default function WorkerProjectRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const projectId = typeof id === "string" && /^[1-9]\d*$/.test(id) ? Number(id) : NaN;
  return <View style={{ flex: 1 }}>
    <HomeownerHeader title="Project Panday" subtitle="Project Details" backTo="/worker/assignments" />
    <WorkerProjectDetails key={`worker-project-${projectId}`} projectId={projectId} />
  </View>;
}
