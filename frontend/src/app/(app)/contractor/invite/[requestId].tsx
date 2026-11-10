import { useLocalSearchParams } from "expo-router";
import ProjectInviteDetails from "@/screens/invites/ProjectInviteDetails";

export default function ContractorInviteDetailsRoute() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  return <ProjectInviteDetails key={requestId} role="contractor" requestId={Number(requestId)} />;
}
