import { useLocalSearchParams } from "expo-router";
import RequestDetail from "@/screens/materialRequests/RequestDetail";

export default function ContractorMaterialRequest() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <RequestDetail key={id} requestId={Number(id)} viewer="contractor" />;
}
