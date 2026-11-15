import { usePlan } from "@/context/PlanContext";
import FindWorkers from "@/screens/homeowner/FindWorkers";

/** Keep the existing worker/contractor filters, ratings, wage previews and hiring workflow. */
export default function FindTeamRoute() {
  const { activeProjectKey, ready } = usePlan();
  // Public browsing stays available during lifecycle checks; hiring state is rebuilt after validation.
  return <FindWorkers key={`${activeProjectKey}:${ready}`} />;
}
