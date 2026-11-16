import { useLocalSearchParams } from "expo-router";
import ContractorProjectDetails from "@/screens/contractor/ProjectDetails";

export default function CompletedProject() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const selected = typeof id === "string" && /^[1-9]\d*$/.test(id) ? Number(id) : NaN;
  return <ContractorProjectDetails key={String(selected)} projectId={selected} history />;
}
