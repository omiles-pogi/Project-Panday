import type { ReactNode } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import Mascot from "@/components/Mascot";
import { Badge } from "@/components/ui";
import { useTheme } from "@/context/ThemeContext";
import { peso } from "@/utils/currency";
import type { RecommendationEvidence, RecommendedWorker, RecommendedContractor, TeamRecommendations as Recommendations } from "@/types/teamRecommendations";

/** Evidence is supplied by the owned project's backend response, never inferred from a badge or score. */
export function RecommendationFacts({ match }: { match: RecommendationEvidence }) {
  return <View style={{ gap: 7, marginBottom: 12 }}>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
      <Badge label="Skills Match" color="#8b5cf6" />
      {match.bestMatch && <Badge label="Best Match" color="#f59e0b" />}
      {match.budgetFit === true && <Badge label="Budget Fit (provisional)" color="#10b981" />}
    </View>
    <Text className="text-xs leading-5 text-foreground">PandAI Recommendation: {match.reason}</Text>
    <Text className="text-xs text-secondary-foreground">Relevant skills: {match.matchedSkills.join(" · ")}</Text>
    <Text className="text-xs text-muted-foreground">{match.availability}</Text>
    {match.estimatedWage !== null && match.estimatedDays !== null
      ? <Text className="text-sm font-bold text-foreground">Provisional project wage: {peso(match.estimatedWage)} for {match.estimatedDays} estimated working days</Text>
      : <Text className="text-xs text-muted-foreground">Project wage estimate unavailable: confirm the asking rate and trade-specific work duration.</Text>}
    {match.durationBasis && <Text className="text-xs leading-4 text-muted-foreground">{match.durationBasis}</Text>}
    {match.budgetFit === false && <Text className="text-xs text-danger">Provisional wage exceeds the remaining approved labor allowance.</Text>}
  </View>;
}

export default function TeamRecommendations({ data, loading, failed, renderWorker, renderContractor }: {
  data: Recommendations | null; loading: boolean; failed: boolean;
  renderWorker: (worker: RecommendedWorker) => ReactNode;
  renderContractor: (contractor: RecommendedContractor) => ReactNode;
}) {
  const { chrome, mode } = useTheme();
  return <View style={{ borderRadius: 20, padding: 14, gap: 12, borderWidth: 1, borderColor: "#a78bfa", backgroundColor: mode === "light" ? "#f7f2ff" : chrome.card }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <Mascot size={46} />
      <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
        <Text style={{ color: chrome.foreground, fontSize: 18, fontWeight: "800" }}>PandAI Recommended Workers</Text>
        <Badge label="AI Recommendation" color="#8b5cf6" />
        {data && <Text style={{ color: chrome.foreground, fontSize: 13 }}>{data.projectTitle}</Text>}
        <Text style={{ color: chrome.secondaryForeground, fontSize: 12 }}>{data?.planApproved ? "Approved AI plan" : "Approved plan required"}</Text>
      </View>
    </View>
    {loading && !data && <ActivityIndicator accessibilityLabel="Loading project recommendations" color="#8b5cf6" />}
    {failed && <Text accessibilityRole="alert" className="text-xs text-danger">Project recommendations could not be loaded. Retry using the refresh action below; manual browsing remains available.</Text>}
    {data ? <>
      <Text className="text-xs leading-5 text-secondary-foreground">{data.notice}</Text>
      <Text className="text-xs text-muted-foreground">Explainable matching against the approved AI plan. Ratings only break relevance ties; experience is self-reported. No live AI request is needed.</Text>
      {data.laborBudget !== null && <Text className="text-xs text-foreground">Approved labor allowance: {peso(data.laborBudget)}{data.remainingLaborBudget !== null ? ` · Remaining before hiring: ${peso(data.remainingLaborBudget)}` : " · Remaining allowance unknown"}</Text>}
      <Text className="text-sm font-bold text-foreground">Recommended Skilled Workers</Text>
      {data.workers.map(worker => <View key={`worker-${data.projectId}-${worker.id}`}>{renderWorker(worker)}</View>)}
      {!data.workers.length && <Text className="text-xs text-muted-foreground">No relevant unassigned skilled workers found for this approved scope. Browse all workers below.</Text>}
      <Text className="text-sm font-bold text-foreground">Recommended Contractors</Text>
      {data.contractorBudget !== null && <Text className="text-xs text-muted-foreground">Approved contractor/management allowance: {peso(data.contractorBudget)}. A contractor quote is required; this is not a stated rate.</Text>}
      {data.contractors.map(contractor => <View key={`contractor-${data.projectId}-${contractor.id}`}>{renderContractor(contractor)}</View>)}
      {!data.contractors.length && <Text className="text-xs text-muted-foreground">No relevant unassigned contractors found. Contractor browsing remains available below.</Text>}
    </> : !loading && !failed ? <Text className="text-xs text-muted-foreground">Select an ongoing project with an approved plan to see recommendations. You can still browse all profiles below.</Text> : null}
  </View>;
}
