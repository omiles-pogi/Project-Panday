import ActiveProjectGate from "@/components/ActiveProjectGate";
import { usePlan } from "@/context/PlanContext";
import ProjectChat from "@/screens/homeowner/ProjectChat";

export default function ProjectChatRoute() {
  const { activeProjectKey } = usePlan();
  // Recreate only local UI on a project switch; all saved conversations remain in PlanContext.
  return <ActiveProjectGate><ProjectChat key={activeProjectKey} /></ActiveProjectGate>;
}
