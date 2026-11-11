import { Tabs } from "expo-router";
import ContractorHeader from "@/components/ContractorHeader";
import Dashboard from "@/screens/contractor/Dashboard";

export default function ContractorDashboardRoute() {
  return <><Tabs.Screen options={{ header: () => <ContractorHeader title="Project Panday" subtitle="Contractor Account" /> }} /><Dashboard /></>;
}
