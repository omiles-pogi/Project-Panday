import { usePlan } from "@/context/PlanContext";
import FindWorkers from "@/screens/homeowner/FindWorkers";
import { useLocalSearchParams } from "expo-router";

/** Keep the existing worker/contractor filters, ratings, wage previews and hiring workflow. */
export default function FindTeamRoute() {
  const { activeProjectKey, ready } = usePlan();
  const { directorySession } = useLocalSearchParams<{ directorySession?: string }>();
  // Public browsing stays available during lifecycle checks; hiring state is rebuilt after validation.
  // A new PandAI entry clears stale search/filter state without changing the selected project.
  return <FindWorkers key={`${activeProjectKey}:${ready}:${directorySession ?? ""}`} />;
}
