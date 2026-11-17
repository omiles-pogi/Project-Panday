import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, Keyboard, Pressable, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Screen } from "@/components/ui";
import { ProfileAvatar } from "@/components/ProfilePhoto";
import { useTheme } from "@/context/ThemeContext";
import { useFocusedResource } from "@/hooks/useFocusedResource";
import { searchWorkers } from "@/services/api/workers";
import { searchContractors } from "@/services/api/contractors";
import { matchesWorkerFilters, workerFilterCount, workerFilterQuery, type DirectoryPerson, type WorkerFilters } from "@/utils/workersFilters";
import { Action, BuildTeamBanner, Identity, Skills, WorkersSectionTitle } from "./WorkersTabUI";
import TeamProfileDetails from "./TeamProfileDetails";
import ProjectHiringPrompt, { useHiringProjectPrompt } from "./ProjectHiringPrompt";
import WorkersFilterDrawer from "./WorkersFilterDrawer";
import type { WorkerSearchResult } from "@/types/worker";
import type { ContractorSearchResult } from "@/types/contractor";

type Person = DirectoryPerson;
type Profile = { id: number; name: string; role: "worker" | "contractor" };

export default function WorkersDirectory({ teamError, onRetryTeam, showBanner = true, showProjectPrompt = true, beforeBanner, header, children, renderWorker, renderContractor, renderInvite, workerTitle = "Explore Skilled Workers" }: {
  teamError?: string | null;
  onRetryTeam?: () => void;
  showBanner?: boolean;
  showProjectPrompt?: boolean;
  beforeBanner?: ReactNode;
  header?: ReactNode;
  children?: ReactNode;
  workerTitle?: string;
  renderWorker?: (worker: WorkerSearchResult) => ReactNode;
  renderContractor?: (contractor: ContractorSearchResult) => ReactNode;
  renderInvite?: (person: DirectoryPerson, role: Profile["role"]) => ReactNode;
}) {
  const { chrome } = useTheme();
  const flow = useHiringProjectPrompt();
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<WorkerFilters | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const refreshLock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [profile, setProfile] = useState<Profile | null>(null);
  const workerKey = JSON.stringify(workerFilterQuery("worker", filters));
  const contractorKey = JSON.stringify(workerFilterQuery("contractor", filters));
  const loadWorkers = useCallback(() => searchWorkers(JSON.parse(workerKey)), [workerKey]);
  const loadContractors = useCallback(() => searchContractors(JSON.parse(contractorKey)), [contractorKey]);
  // Account eligibility and profile privacy come from these existing APIs. No project,
  // plan, team membership or recommendation data is requested to browse the directory.
  const workers = useFocusedResource(loadWorkers);
  const contractors = useFocusedResource(loadContractors);
  const refreshResults = (types: WorkerFilters["type"][]) => {
    if (refreshLock.current || !types.length) return;
    refreshLock.current = true; setRefreshing(true);
    void Promise.all(types.map(type => type === "worker" ? workers.refresh() : contractors.refresh())).finally(() => {
      refreshLock.current = false; if (mounted.current) setRefreshing(false);
    });
  };
  const busy = workers.loading || contractors.loading || refreshing;
  const apply = (next: WorkerFilters) => {
    if (busy || refreshLock.current) return;
    setFilters(next);
    // Changed API parameters reload through useFocusedResource. Rate-only/repeated
    // applications still refresh the same endpoint, once, with a submission lock.
    const previousKey = next.type === "worker" ? workerKey : contractorKey;
    if (JSON.stringify(workerFilterQuery(next.type, next)) === previousKey) refreshResults([next.type]);
  };
  const clear = () => {
    if (busy || refreshLock.current) return;
    setFilters(null);
    const unchanged: WorkerFilters["type"][] = [];
    if (workerKey === JSON.stringify(workerFilterQuery("worker", null))) unchanged.push("worker");
    if (contractorKey === JSON.stringify(workerFilterQuery("contractor", null))) unchanged.push("contractor");
    refreshResults(unchanged);
  };
  const count = workerFilterCount(filters);
  const section = (title: string, role: Profile["role"], resource: { data: Person[] | null; error: string | null; loading: boolean; refresh: () => Promise<void> }) => {
    const people = (resource.data ?? []).filter(person => matchesWorkerFilters(person, query, filters));
    const filtered = !!(query.trim() || filters);
    return <View style={{ gap: 10 }}>
      <WorkersSectionTitle>{title}</WorkersSectionTitle>
      {resource.loading && !resource.data && <ActivityIndicator accessibilityLabel={`Loading ${title.toLowerCase()}`} color="#f59e0b" />}
      {resource.error && <View style={{ gap: 6 }}><Text accessibilityRole="alert" style={{ color: "#ef4444", fontSize: 12 }}>Could not load approved {role === "worker" ? "workers" : "contractors"}. {resource.error}</Text><Action label={`Retry ${role === "worker" ? "workers" : "contractors"}`} onPress={() => void resource.refresh()} /></View>}
      {!resource.loading && !resource.error && !people.length && <Text style={{ color: chrome.secondaryForeground, fontSize: 12 }}>No approved {role === "worker" ? "workers" : "contractors"} {filtered ? "match these filters." : "are available yet."}</Text>}
      {people.map(person => {
        // The standalone route reuses its existing project-aware hiring cards; the
        // dashboard's public browsing cards keep their current appearance and behavior.
        if ("trade" in person && renderWorker) return <View key={person.id}>{renderWorker(person)}</View>;
        if ("specialization" in person && renderContractor) return <View key={person.id}>{renderContractor(person)}</View>;
        return <View key={person.id} style={{ backgroundColor: chrome.card, borderColor: chrome.border, borderWidth: 1, borderRadius: 18, padding: 12, gap: 10, shadowColor: "#000", shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 5, elevation: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><ProfileAvatar name={person.name} url={"photoUrl" in person ? person.photoUrl : undefined} size={46} /><Identity person={person} /></View>
        <Skills skills={person.skills} />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "flex-end" }}>
          <Action label="View Profile" accessibilityLabel={`View ${person.name}'s profile`} icon="eye-outline" onPress={() => setProfile({ id: person.id, name: person.name, role })} />
          {renderInvite ? renderInvite(person, role) : <Action label="Invite to Project" disabled onPress={flow.requireProject} />}
        </View>
      </View>; })}
    </View>;
  };
  return <Screen topInset={false}>
    {beforeBanner}
    {showBanner && <BuildTeamBanner canInvite onBrowse={() => router.push("/homeowner/find-team" as never)} />}
    {header}
    {teamError && <View style={{ gap: 6 }}><Text accessibilityRole="alert" style={{ color: "#ef4444" }}>{teamError}</Text>{onRetryTeam && <Action label="Retry team" onPress={onRetryTeam} />}</View>}
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <View style={{ flex: 1, minWidth: 0, height: 44, borderWidth: 1, borderColor: chrome.border, borderRadius: 12, paddingHorizontal: 10, backgroundColor: chrome.card, flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Ionicons name="search-outline" size={18} color={chrome.secondaryForeground} />
        <TextInput accessibilityLabel="Search workers and contractors" placeholder="Search workers..." placeholderTextColor={chrome.secondaryForeground} value={query} onChangeText={setQuery} returnKeyType="search" onSubmitEditing={Keyboard.dismiss} autoCorrect={false}
          style={{ flex: 1, minWidth: 0, color: chrome.foreground, fontSize: 13, paddingVertical: 8 }} />
        {!!query && <Pressable accessibilityRole="button" accessibilityLabel="Clear worker search" onPress={() => setQuery("")} hitSlop={2} style={{ width: 28, height: 40, alignItems: "center", justifyContent: "center" }}><Ionicons name="close-circle" size={17} color={chrome.secondaryForeground} /></Pressable>}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Filter workers" accessibilityHint={`${count} active filters`} accessibilityState={{ expanded: filterOpen, disabled: busy }} aria-expanded={filterOpen} disabled={busy}
        onPress={() => { Keyboard.dismiss(); setFilterOpen(true); }} style={{ height: 44, minWidth: 88, flexShrink: 0, paddingHorizontal: 10, borderWidth: 1, borderColor: "#f59e0b", borderRadius: 12, backgroundColor: chrome.card, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, opacity: busy ? 0.6 : 1 }}>
        <Ionicons name="options-outline" size={17} color="#d97706" /><Text numberOfLines={1} style={{ color: chrome.foreground, fontSize: 12, fontWeight: "700" }}>Filter</Text>
        {count > 0 && <Text style={{ color: "#11141c", backgroundColor: "#f59e0b", borderRadius: 8, minWidth: 16, textAlign: "center", fontSize: 10, paddingHorizontal: 3 }}>{count > 9 ? "9+" : count}</Text>}
      </Pressable>
    </View>
    {(!filters || filters.type === "worker") && section(workerTitle, "worker", workers)}
    {(!filters || filters.type === "contractor") && section("Explore Contractors", "contractor", contractors)}
    {children}
    {showProjectPrompt && <ProjectHiringPrompt flow={flow} />}
    {profile && <TeamProfileDetails key={`${profile.role}-${profile.id}`} member={profile} onClose={() => setProfile(null)} />}
    {filterOpen && <WorkersFilterDrawer initial={filters} workers={workers.data ?? []} contractors={contractors.data ?? []} loading={busy} workerError={workers.error} contractorError={contractors.error}
      onRetry={type => refreshResults([type])} onApply={apply} onClear={clear} onClose={() => setFilterOpen(false)} />}
  </Screen>;
}
