import { useLocalSearchParams } from "expo-router";
import ProjectInviteDetails from "@/screens/invites/ProjectInviteDetails";

export default function WorkerInviteDetailsRoute() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  return <ProjectInviteDetails key={requestId} role="worker" requestId={Number(requestId)} />;
}
