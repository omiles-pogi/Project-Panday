import WorkersDashboard from "@/screens/homeowner/WorkersDashboard";
import { usePlan } from "@/context/PlanContext";

export default function Marketplace() {
  const { activeProjectKey } = usePlan();
  // Only project-specific local state resets on selection; the public directory needs no project gate.
  return <WorkersDashboard key={activeProjectKey} />;
}
