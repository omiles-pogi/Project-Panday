import { Tabs } from "expo-router";
import WorkerHeader from "@/components/WorkerHeader";
import Screen from "@/screens/worker/AvailableProjects";

export default function WorkerRoute() {
  return <><Tabs.Screen options={{ header: () => <WorkerHeader /> }} /><Screen /></>;
}
