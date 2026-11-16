import type { ReactNode } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/context/ThemeContext";
import { ProfileAvatar } from "@/components/ProfilePhoto";
import MessageButton from "@/components/MessageButton";
import { teamActionStyles } from "@/components/teamActionStyles";
import { peso } from "@/utils/currency";
import type { HomeownerTeamMember, HomeownerTeamOverview } from "@/services/api/homeownerTeam";
import type { WorkerSearchResult } from "@/types/worker";
import type { ContractorSearchResult } from "@/types/contractor";

type Icon = keyof typeof Ionicons.glyphMap;
const ORANGE = "#f59e0b";
const HOUSE = require("../../../assets/home-hero-house.png");
const CREW = require("../../../assets/workers-build-team.png");

export function Action({ label, accessibilityLabel = label, onPress, disabled = false, filled = false, icon, tile = false }: {
  label: string; accessibilityLabel?: string; onPress: () => void; disabled?: boolean; filled?: boolean; icon?: Icon; tile?: boolean;
}) {
  const { chrome, mode } = useTheme();
  const color = filled ? "#11141c" : icon && !tile ? mode === "light" ? "#b45309" : "#fbbf24" : chrome.secondaryForeground;
  const trailing = !tile && (icon === "chevron-forward" || icon === "arrow-forward");
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} disabled={disabled} onPress={onPress}
    style={[styles.action, tile && teamActionStyles.tile, { backgroundColor: filled ? ORANGE : chrome.card, borderColor: icon && !tile ? ORANGE : chrome.border, opacity: disabled ? 0.55 : 1 }]}>
    {icon && !trailing && <Ionicons name={icon} size={tile ? teamActionStyles.iconSize : 14} color={color} />}
    <Text numberOfLines={tile ? 1 : undefined} maxFontSizeMultiplier={tile ? 1.2 : 1.4} style={[{ color, fontSize: 12, fontWeight: "700", textAlign: "center", flexShrink: 1 }, tile && teamActionStyles.label]}>{label}</Text>
    {icon && trailing && <Ionicons name={icon} size={14} color={color} />}
  </Pressable>;
}

export function Skills({ skills, compact = false }: { skills: string[]; compact?: boolean }) {
  const { chrome, mode } = useTheme();
  const visible = compact ? 2 : 3;
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
    {skills.slice(0, visible).map(skill => <Text key={skill} style={{ color: chrome.foreground, backgroundColor: mode === "light" ? "#fff1dc" : "#3b3020", borderRadius: 12, paddingHorizontal: 6, paddingVertical: 3, fontSize: 9.5 }}>{skill}</Text>)}
    {skills.length > visible && <Text accessibilityLabel={`${skills.length - visible} more skills available in View Profile`} style={{ color: chrome.secondaryForeground, backgroundColor: chrome.muted, borderRadius: 12, paddingHorizontal: 6, paddingVertical: 3, fontSize: 9.5 }}>+{skills.length - visible}</Text>}
  </View>;
}

export function Identity({ person, compact = false }: { person: {
  name: string; trade?: string | null; specialization?: string | null; averageRating: number | null; ratingCount: number;
}; compact?: boolean }) {
  const { chrome } = useTheme();
  return <View style={{ minWidth: 0, flex: 1, gap: 2 }}>
    <Text style={{ color: chrome.foreground, fontSize: compact ? 13 : 14, lineHeight: compact ? 17 : 18, fontWeight: "800" }}>{person.name}</Text>
    <Text style={{ color: chrome.secondaryForeground, fontSize: compact ? 10.5 : 11.5 }}>{person.trade || person.specialization || "Specialization not provided"}</Text>
    <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 3 }}>
      {person.averageRating != null && <Ionicons name="star" size={12} color={ORANGE} />}
      <Text style={{ color: chrome.secondaryForeground, fontSize: compact ? 9 : 10 }}>
        {person.averageRating == null ? "No ratings yet" : `${person.averageRating} (${person.ratingCount} ${person.ratingCount === 1 ? "review" : "reviews"})`}
      </Text>
    </View>
  </View>;
}

export function OverviewBanner({ overview, pendingCount, columns, showInfo, onInfo }: {
  overview: HomeownerTeamOverview; pendingCount: number; columns: number; showInfo: boolean; onInfo: () => void;
}) {
  const { chrome, mode } = useTheme();
  const values: { label: string; value: number | null; icon: Icon; color: string }[] = [
    { label: "Total Team", value: overview.metrics.total, icon: "people-outline", color: "#ed7800" },
    { label: "Active", value: overview.metrics.active, icon: "checkmark-circle-outline", color: mode === "light" ? "#15803d" : "#4ade80" },
    { label: "Pending", value: pendingCount, icon: "hourglass-outline", color: "#efa600" },
    { label: "Needed", value: overview.metrics.needed, icon: "construct-outline", color: "#ed7800" },
  ];
  return <LinearGradient colors={mode === "light" ? ["#fffaf0", "#ffe18b"] : ["#30291b", "#55431b"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.6 }} style={styles.banner}>
    <View style={{ flexDirection: "row", minHeight: 54, alignItems: "center", gap: 9 }}>
      <View style={{ width: 4, height: 30, borderRadius: 3, backgroundColor: "#f58014" }} />
      <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
        <Text style={{ fontSize: 18, lineHeight: 23, fontWeight: "800", color: chrome.foreground }}>Project Panday</Text>
        <Text style={{ fontSize: 12, color: chrome.secondaryForeground }}>Team Overview</Text>
        <Text numberOfLines={1} style={{ fontSize: 10, color: chrome.secondaryForeground }}>{overview.title}</Text>
      </View>
      <Image source={HOUSE} resizeMode="contain" accessible={false} style={{ width: columns === 4 ? 94 : 74, height: 62 }} />
      <Pressable accessibilityRole="button" accessibilityLabel="Team statistics information" accessibilityState={{ expanded: showInfo }} onPress={onInfo} hitSlop={6} style={{ paddingVertical: 10, paddingHorizontal: 1 }}>
        <Ionicons name="information-circle-outline" size={17} color={chrome.secondaryForeground} />
      </Pressable>
    </View>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
      {values.map(({ label, value, icon, color }) => <View key={label} accessibilityLabel={`${label}: ${value ?? "unavailable"}`}
        style={[styles.stat, { flexBasis: columns === 4 ? "22%" : "45%", backgroundColor: chrome.card }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <Ionicons name={icon} size={19} color={color} />
          <Text maxFontSizeMultiplier={1.4} style={{ color: chrome.foreground, fontSize: 19, lineHeight: 23, fontWeight: "800" }}>{value ?? "—"}</Text>
        </View>
        <Text maxFontSizeMultiplier={1.2} style={{ color: chrome.secondaryForeground, fontSize: 9.5, textAlign: "center" }}>{label}</Text>
      </View>)}
    </View>
    {showInfo && <Text style={{ color: chrome.secondaryForeground, fontSize: 11, lineHeight: 16, marginTop: 8 }}>Total includes accepted workers and contractors. Active counts assignments to ongoing construction, not attendance. Needed is unavailable: no staffing headcount target is recorded.</Text>}
  </LinearGradient>;
}

export function BuildTeamBanner({ canInvite, onBrowse }: { canInvite: boolean; onBrowse: () => void }) {
  const { chrome, mode } = useTheme();
  return <LinearGradient colors={mode === "light" ? ["#fff8e5", "#ffe293", "#ffd04a"] : ["#30291b", "#49371c", "#624814"]}
    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.7 }} style={[styles.banner, { padding: 11, minHeight: 114 }]}>
    <Image source={CREW} resizeMode="contain" accessible={false} style={{ position: "absolute", right: -1, bottom: -3, width: "44%", height: "101%" }} />
    <View style={{ width: "57%", gap: 5 }}>
      <Text style={{ color: chrome.foreground, fontSize: 17, lineHeight: 22, fontWeight: "800" }}>Build Your Team</Text>
      <Text style={{ color: chrome.secondaryForeground, fontSize: 11.5, lineHeight: 16 }}>Find skilled construction workers for your project.</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={canInvite ? "Browse Skilled Workers" : "Continue planning with PandAI"} onPress={onBrowse}
        style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 3, marginTop: 3, minHeight: 34, paddingVertical: 6, paddingHorizontal: 9,
          borderWidth: 1.2, borderColor: "#f58b00", borderRadius: 22, backgroundColor: mode === "light" ? "#fff5d6" : "#30291b" }}>
        <Text style={{ flexShrink: 1, fontSize: 10.5, lineHeight: 14, fontWeight: "800", color: mode === "light" ? "#bb5a00" : "#fbbf24" }}>{canInvite ? "Browse Skilled Workers" : "Continue planning with PandAI"}</Text>
        <Ionicons name="chevron-forward" size={16} color={mode === "light" ? "#d66a00" : "#fbbf24"} />
      </Pressable>
    </View>
  </LinearGradient>;
}

export function CurrentTeamCard({ member, projectId, inline, onView, onAssignment, isCurrent }: {
  member: HomeownerTeamMember; projectId: number; inline: boolean; onView: () => void; onAssignment: () => void; isCurrent: () => boolean;
}) {
  const { chrome, mode } = useTheme();
  const status = <View style={{ alignSelf: "flex-end", backgroundColor: mode === "light" ? "#fff0dc" : "#49351d", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 }}>
    <Text style={{ color: mode === "light" ? "#a45106" : "#ffbd68", fontSize: 10, fontWeight: "700" }}>{member.status}</Text>
  </View>;
  const actions = <View style={{ flexDirection: "row", flexWrap: "nowrap", alignItems: "flex-start", gap: 4, justifyContent: "flex-end", marginTop: 7 }}>
    <Action label="View" icon="eye-outline" tile onPress={onView} />
    <MessageButton projectId={projectId} workerId={member.role === "worker" ? member.id : undefined} contractorId={member.role === "contractor" ? member.id : undefined}
      chatPath={id => `/homeowner/messages/${id}`} label={`Message ${member.name}`} compact isCurrent={isCurrent}
      tile={{ backgroundColor: chrome.card, foregroundColor: chrome.secondaryForeground, borderColor: chrome.border }} />
    {member.role === "worker" && <Action label="Tasks" accessibilityLabel="Assignment" icon="calendar-outline" tile onPress={onAssignment} />}
  </View>;
  return <View style={[styles.card, { backgroundColor: chrome.card, borderColor: chrome.border, flexDirection: "row", gap: 9, padding: 11 }]}>
    <View style={{ paddingTop: 2 }}><ProfileAvatar name={member.name} url={member.photoUrl} size={46} /></View>
    <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 4 }}><Identity person={member} />{!inline && status}</View>
      <Skills skills={member.skills} compact={inline} />
      {!inline && actions}
    </View>
    {inline && <View style={{ width: 140, flexShrink: 0, justifyContent: "center" }}>{status}{actions}</View>}
  </View>;
}

export function RecommendedWorkerCard({ worker, inviteLabel, disabled, onInvite, onView }: {
  worker: WorkerSearchResult | ContractorSearchResult; inviteLabel: string; disabled: boolean; onInvite: () => void; onView: () => void;
}) {
  const { chrome, mode } = useTheme();
  return <View style={[styles.card, { backgroundColor: chrome.card, borderColor: chrome.border, padding: 10, gap: 7, flex: 1 }]}>
    <View style={{ alignSelf: "flex-end", flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: mode === "light" ? "#f5eaff" : "#3e2557", borderRadius: 12, paddingHorizontal: 6, paddingVertical: 3 }}>
      <Ionicons name="sparkles" size={10} color={mode === "light" ? "#9333d2" : "#deb0ff"} />
      <Text accessibilityLabel="Matched using skills from the approved AI plan" style={{ fontSize: 9, fontWeight: "600", color: mode === "light" ? "#7e22ce" : "#deb0ff" }}>AI Matched</Text>
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel={`View ${worker.name}'s profile`} onPress={onView} style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
      <ProfileAvatar name={worker.name} url={worker.photoUrl} size={36} /><Identity person={worker} compact />
    </Pressable>
    <Text style={{ color: chrome.secondaryForeground, fontSize: 10, lineHeight: 14 }}>{worker.skills.slice(0, 3).join(" · ")}</Text>
    <View style={{ marginTop: "auto", flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 5 }}>
      {"minDailyWage" in worker && worker.minDailyWage != null && <Text style={{ color: mode === "light" ? "#c45c00" : "#fbbf24", fontSize: 13, fontWeight: "800" }}>{peso(worker.minDailyWage)}<Text style={{ color: chrome.secondaryForeground, fontSize: 10, fontWeight: "400" }}> / day</Text></Text>}
      <Action label={inviteLabel} icon={inviteLabel === "Invite" ? "chevron-forward" : undefined} disabled={disabled} onPress={onInvite} />
    </View>
  </View>;
}

export function WorkersSectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  const { chrome } = useTheme();
  return <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
    <Text style={{ color: chrome.foreground, fontSize: 16, lineHeight: 21, fontWeight: "800", flex: 1 }}>{children}</Text>{action}
  </View>;
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1, shadowColor: "#000", shadowOpacity: 0.06, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2 },
  banner: { borderRadius: 20, padding: 10, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 5, elevation: 2 },
  stat: { flexGrow: 1, minWidth: 0, borderRadius: 12, padding: 7, alignItems: "center", gap: 1, minHeight: 47 },
  action: { minHeight: 32, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderRadius: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
});
