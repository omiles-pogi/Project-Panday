import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Keyboard, Modal, Platform, Pressable, Text, TextInput, View, useWindowDimensions } from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/context/ThemeContext";
import KeyboardView from "@/components/KeyboardView";
import KeyboardAwareScrollView from "@/components/KeyboardAwareScrollView";
import { emptyWorkerFilters, normalizeWorkerFilters, validateWorkerFilters, workerFilterOptions, type DirectoryPerson, type WorkerFilters } from "@/utils/workersFilters";

function SpecialtyPicker({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (value: string) => void }) {
  const { chrome, mode } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  return <View style={{ gap: 8 }}>
    <Text style={{ color: chrome.foreground, fontWeight: "700", fontSize: 13 }}>{label}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`Select ${label.toLowerCase()}`} accessibilityState={{ expanded: open }} aria-expanded={open} onPress={() => setOpen(value => !value)}
      style={{ minHeight: 44, borderWidth: 1, borderColor: chrome.border, borderRadius: 12, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: chrome.muted }}>
      <Text style={{ color: chrome.foreground, flex: 1, fontSize: 13 }}>{value || (label === "Trade" ? "All trades" : "All specializations")}</Text><Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={chrome.secondaryForeground} />
    </Pressable>
    {open && <View style={{ gap: 4, padding: 8, borderWidth: 1, borderColor: chrome.border, borderRadius: 12 }}>
      <TextInput accessibilityLabel={`Search ${label.toLowerCase()}`} placeholder="Search options..." placeholderTextColor={chrome.secondaryForeground} value={query} onChangeText={setQuery}
        style={{ color: chrome.foreground, backgroundColor: chrome.muted, borderRadius: 10, padding: 10, minHeight: 44 }} />
      {["", ...options.filter(option => option.toLowerCase().includes(query.trim().toLowerCase()))].map(option => <Pressable key={option} accessibilityRole="radio" accessibilityState={{ checked: value === option }} aria-checked={value === option} onPress={() => { onChange(option); setOpen(false); }} style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 8 }}>
        <Text style={{ color: value === option ? mode === "dark" ? "#fbbf24" : "#a75400" : chrome.foreground, fontSize: 13 }}>{option || "All"}</Text>
      </Pressable>)}
      {!options.length && <Text style={{ color: chrome.secondaryForeground, fontSize: 12 }}>No registered options are available yet.</Text>}
    </View>}
  </View>;
}

interface DrawerProps {
  initial: WorkerFilters | null; workers: DirectoryPerson[]; contractors: DirectoryPerson[]; loading: boolean;
  workerError: string | null; contractorError: string | null; onRetry: (type: WorkerFilters["type"]) => void;
  onApply: (filters: WorkerFilters) => void; onClear: () => void; onClose: () => void;
}

export default function WorkersFilterDrawer(props: DrawerProps) {
  const { width } = useWindowDimensions();
  const { chrome } = useTheme();
  const [progress] = useState(() => new Animated.Value(1));
  const closing = useRef(false);
  const panelWidth = Math.min(400, Math.max(0, width - 24));
  useEffect(() => () => progress.stopAnimation(), [progress]);
  const close = () => {
    if (closing.current) return;
    closing.current = true; Keyboard.dismiss();
    Animated.timing(progress, { toValue: 1, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: Platform.OS !== "web" }).start(({ finished }) => { if (finished) props.onClose(); });
  };
  return <Modal visible transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={close}
    onShow={() => { if (!closing.current) Animated.timing(progress, { toValue: 0, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== "web" }).start(); }}>
    <SafeAreaProvider>
      {/* Reuse the app's measured modal keyboard avoidance; keep footer outside the scroll body. */}
      <KeyboardView modal className="flex-1" style={{ flex: 1, backgroundColor: "transparent" }}>
        <View style={{ flex: 1, flexDirection: "row", justifyContent: "flex-end" }}>
          <Animated.View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#0008", opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Close worker filters backdrop" onPress={close} style={{ flex: 1 }} />
          </Animated.View>
          <Animated.View accessibilityViewIsModal style={{ width: panelWidth, backgroundColor: chrome.card, borderTopLeftRadius: 22, borderBottomLeftRadius: 22, overflow: "hidden",
            transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, panelWidth] }) }], shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 14, elevation: 20 }}>
            <DrawerPanel {...props} onClose={close} onApply={filters => { if (!closing.current && !props.loading) { props.onApply(filters); close(); } }}
              onClear={() => { if (!closing.current && !props.loading) { props.onClear(); close(); } }} />
          </Animated.View>
        </View>
      </KeyboardView>
    </SafeAreaProvider>
  </Modal>;
}

function DrawerPanel({ initial, workers, contractors, loading, workerError, contractorError, onRetry, onApply, onClear, onClose }: DrawerProps) {
  const { chrome, mode } = useTheme();
  const insets = useSafeAreaInsets();
  // This component mounts for each opening: Cancel/X/backdrop/Back discard drafts.
  const [draft, setDraft] = useState<WorkerFilters>(() => ({ ...(initial ?? emptyWorkerFilters()), skills: [...(initial?.skills ?? [])] }));
  const [error, setError] = useState<string | null>(null);
  const submitted = useRef(false);
  const options = workerFilterOptions(draft.type === "worker" ? workers : contractors);
  const sourceError = draft.type === "worker" ? workerError : contractorError;
  const toggleSkill = (skill: string) => {
    setError(null);
    if (draft.skills.includes(skill)) setDraft(value => ({ ...value, skills: value.skills.filter(value => value !== skill) }));
    else if (draft.skills.length >= 20) setError("Choose up to 20 skills or services.");
    else setDraft(value => ({ ...value, skills: [...value.skills, skill] }));
  };
  const apply = () => {
    if (loading || submitted.current) return;
    const next = normalizeWorkerFilters(draft), invalid = validateWorkerFilters(next);
    if (invalid) { setError(invalid); return; }
    submitted.current = true; onApply(next);
  };
  const sectionStyle = { color: chrome.foreground, fontSize: 13, fontWeight: "700" as const };
  return <View style={{ flex: 1 }}>
    <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderColor: chrome.border, flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Text accessibilityRole="header" style={{ color: chrome.foreground, fontSize: 20, fontWeight: "800", flex: 1 }}>Filter Workers</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Close filters" onPress={onClose} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22, backgroundColor: chrome.muted }}><Ionicons name="close" size={21} color={chrome.foreground} /></Pressable>
    </View>
    <KeyboardAwareScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 20 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      <View style={{ gap: 9 }}><Text style={sectionStyle}>Worker Type</Text>
        <View accessibilityRole="radiogroup" style={{ flexDirection: "row", gap: 8 }}>
          {(["worker", "contractor"] as const).map(type => <Pressable key={type} accessibilityRole="radio" accessibilityLabel={type === "worker" ? "Skilled Worker" : "Contractor"} accessibilityState={{ checked: draft.type === type }} aria-checked={draft.type === type}
            onPress={() => { setDraft(emptyWorkerFilters(type)); setError(null); }} style={{ flex: 1, minHeight: 44, padding: 9, alignItems: "center", justifyContent: "center", borderRadius: 12, borderWidth: 1, borderColor: draft.type === type ? "#f59e0b" : chrome.border, backgroundColor: draft.type === type ? "#f59e0b" : chrome.card }}>
            <Text style={{ color: draft.type === type ? "#11141c" : chrome.foreground, fontWeight: "700", fontSize: 12, textAlign: "center" }}>{type === "worker" ? "Skilled Worker" : "Contractor"}</Text>
          </Pressable>)}
        </View>
      </View>
      {sourceError && <View style={{ gap: 8 }}><Text accessibilityRole="alert" style={{ color: "#ef4444", fontSize: 12 }}>Filter options could not be refreshed. {sourceError}</Text><Pressable accessibilityRole="button" accessibilityLabel="Retry filter options" onPress={() => onRetry(draft.type)} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ color: chrome.foreground }}>Retry options</Text></Pressable></View>}
      <SpecialtyPicker key={draft.type} label={draft.type === "worker" ? "Trade" : "Contractor Specialization"} options={options.specialties} value={draft.specialty} onChange={specialty => setDraft(value => ({ ...value, specialty }))} />
      <View style={{ gap: 9 }}><Text style={sectionStyle}>Skills / Services</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{options.skills.map(skill => <Pressable key={skill} accessibilityRole="checkbox" accessibilityLabel={`${draft.type === "worker" ? "Skill" : "Service"}: ${skill}`} accessibilityState={{ checked: draft.skills.includes(skill) }} aria-checked={draft.skills.includes(skill)} onPress={() => toggleSkill(skill)}
          style={{ minHeight: 44, maxWidth: "100%", paddingVertical: 9, paddingHorizontal: 12, justifyContent: "center", borderRadius: 22, borderWidth: 1, borderColor: draft.skills.includes(skill) ? "#f59e0b" : chrome.border, backgroundColor: draft.skills.includes(skill) ? "#f59e0b" : chrome.muted }}>
          <Text style={{ color: draft.skills.includes(skill) ? "#11141c" : chrome.foreground, fontSize: 12, flexShrink: 1 }}>{skill}</Text>
        </Pressable>)}</View>
        {!options.skills.length && <Text style={{ color: chrome.secondaryForeground, fontSize: 12 }}>No registered {draft.type === "worker" ? "skills" : "services"} are available yet.</Text>}
      </View>
      <View style={{ gap: 9 }}><Text style={sectionStyle}>Availability</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ minHeight: 44, padding: 12, justifyContent: "center", backgroundColor: mode === "light" ? "#fff1d8" : "#49351d", borderColor: "#f59e0b", borderWidth: 1, borderRadius: 12 }}><Text style={{ color: chrome.foreground, fontSize: 12 }}>All</Text></View>
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: true }} disabled style={{ minHeight: 44, padding: 12, justifyContent: "center", borderWidth: 1, borderColor: chrome.border, borderRadius: 12, opacity: 0.5 }}><Text style={{ color: chrome.secondaryForeground, fontSize: 12 }}>Available Now</Text></Pressable>
        </View><Text style={{ color: chrome.secondaryForeground, fontSize: 11, lineHeight: 16 }}>Availability is not recorded in the current directory.</Text>
      </View>
      <View style={{ gap: 9 }}><Text style={sectionStyle}>Rate Range / Budget</Text>
        {draft.type === "worker" ? <>
          <Text style={{ color: chrome.secondaryForeground, fontSize: 11, lineHeight: 16 }}>Worker asking rate (₱/day). Unknown rates are excluded only when a range is set.</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>{(["minRate", "maxRate"] as const).map(field => <View key={field} style={{ flex: 1, flexBasis: 100, minWidth: 100, gap: 6 }}>
            <Text style={{ color: chrome.secondaryForeground, fontSize: 11 }}>{field === "minRate" ? "Minimum Rate" : "Maximum Rate"}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: chrome.border, backgroundColor: chrome.muted, borderRadius: 12, paddingHorizontal: 10, minHeight: 44 }}>
              <Text style={{ color: chrome.secondaryForeground }}>₱</Text><TextInput accessibilityLabel={field === "minRate" ? "Minimum Rate" : "Maximum Rate"} value={draft[field]} onChangeText={value => { setDraft(current => ({ ...current, [field]: value })); setError(null); }} keyboardType="decimal-pad" placeholder="Any" placeholderTextColor={chrome.secondaryForeground} style={{ flex: 1, minWidth: 0, minHeight: 44, color: chrome.foreground, fontSize: 13, paddingVertical: 8 }} />
            </View>
          </View>)}</View>
        </> : <Text style={{ color: chrome.secondaryForeground, fontSize: 12, lineHeight: 18 }}>Contractor quotes are project-specific. No comparable directory rate is stored, so budget filtering is unavailable.</Text>}
      </View>
    </KeyboardAwareScrollView>
    <View style={{ borderTopWidth: 1, borderColor: chrome.border, paddingHorizontal: 16, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 12), gap: 10 }}>
      {error && <Text accessibilityRole="alert" style={{ color: "#ef4444", fontSize: 12 }}>{error}</Text>}
      <View style={{ flexDirection: "row", gap: 10 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Clear worker filters" disabled={loading} onPress={() => { if (!submitted.current && !loading) { submitted.current = true; onClear(); } }} style={{ flex: 1, minHeight: 46, padding: 10, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: chrome.border, borderRadius: 12, opacity: loading ? 0.5 : 1 }}><Text style={{ color: chrome.foreground, fontSize: 13, fontWeight: "700" }}>Clear</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Apply worker filters" disabled={loading} onPress={apply} style={{ flex: 1.5, minHeight: 46, padding: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#f59e0b", borderRadius: 12, opacity: loading ? 0.5 : 1 }}><Text style={{ color: "#11141c", fontSize: 13, fontWeight: "700" }}>{loading ? "Loading…" : "Apply Filters"}</Text></Pressable>
      </View>
    </View>
  </View>;
}
