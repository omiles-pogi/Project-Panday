import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import HomeownerHeader from "@/components/HomeownerHeader";
import ContractorProjectDetails from "@/screens/contractor/ProjectDetails";

/** A drawer detail preserves its originating tab for Android Back. No second footer/header. */
export default function ContractorProjectRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const selected = typeof id === "string" && /^[1-9]\d*$/.test(id) ? Number(id) : NaN;
  return <View style={{ flex: 1 }}>
    <HomeownerHeader title="Project Panday" subtitle="Contractor Account" />
    <ContractorProjectDetails key={`contractor-project-${selected}`} projectId={selected} />
  </View>;
}
