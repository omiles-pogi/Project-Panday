import { useCallback } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/context/ThemeContext";
import { useFocusedResource } from "@/hooks/useFocusedResource";
import { fetchWorkerProfile } from "@/services/api/workers";
import { fetchContractorProfile } from "@/services/api/contractors";
import { ProfileAvatar } from "@/components/ProfilePhoto";
import { peso } from "@/utils/currency";
import type { HomeownerTeamMember } from "@/services/api/homeownerTeam";
import type { WorkerPublicProfile } from "@/types/worker";
import type { ContractorPublicProfile } from "@/types/contractor";

/** Read-only presentation of the existing public profile API; no new profile or upload flow. */
export default function TeamProfileDetails({ member, onClose }: { member: Pick<HomeownerTeamMember, "id" | "name" | "role">; onClose: () => void }) {
  const { chrome } = useTheme();
  const load = useCallback(() => member.role === "worker" ? fetchWorkerProfile(member.id) : fetchContractorProfile(member.id), [member.id, member.role]);
  const { data, loading, error, refresh } = useFocusedResource<WorkerPublicProfile | ContractorPublicProfile>(load);
  return <Modal visible transparent animationType="fade" onRequestClose={onClose}>
    <View style={{ flex: 1, justifyContent: "center", padding: 20, backgroundColor: "#00000080" }}>
      <View style={{ backgroundColor: chrome.card, borderColor: chrome.border, borderWidth: 1, borderRadius: 24, padding: 20, maxHeight: "85%", width: "100%", maxWidth: 560, alignSelf: "center" }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <Text style={{ fontSize: 18, fontWeight: "800", color: chrome.foreground }}>Profile Details</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close profile details" onPress={onClose} style={{ padding: 10 }}><Ionicons name="close" size={22} color={chrome.foreground} /></Pressable>
        </View>
        {loading && <ActivityIndicator color="#f59e0b" />}
        {error && <View style={{ gap: 10 }}><Text accessibilityRole="alert" style={{ color: "#ef4444" }}>{error}</Text><Pressable accessibilityRole="button" onPress={() => void refresh()}><Text style={{ color: "#f59e0b" }}>Retry profile</Text></Pressable></View>}
        {data && data.id === member.id && <ScrollView contentContainerStyle={{ gap: 12 }}>
          <ProfileAvatar name={data.name} url={data.photoUrl} size={64} />
          <Text style={{ color: chrome.foreground, fontSize: 20, fontWeight: "800" }}>{data.name}</Text>
          <Text style={{ color: chrome.secondaryForeground }}>{"trade" in data ? data.trade || "Trade not provided" : data.specialization || "Specialization not provided"}</Text>
          {data.yearsExperience != null && <Text style={{ color: chrome.secondaryForeground }}>{data.yearsExperience} years of experience</Text>}
          <Text style={{ color: chrome.secondaryForeground }}>{data.averageRating == null ? "No ratings yet" : `${data.averageRating} / 5 · ${data.ratingCount} reviews`}</Text>
          {"minDailyWage" in data && data.minDailyWage != null && <Text style={{ color: chrome.foreground }}>Asking rate: {peso(data.minDailyWage)}/day</Text>}
          {data.bio && <Text style={{ color: chrome.foreground, lineHeight: 22 }}>{data.bio}</Text>}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>{data.skills.map(skill => <Text key={skill} style={{ backgroundColor: "#f59e0b18", color: chrome.foreground, padding: 8, borderRadius: 10 }}>{skill}</Text>)}</View>
          {data.ratings.map((rating, index) => <View key={`${rating.createdAt}-${index}`} style={{ borderTopWidth: 1, borderTopColor: chrome.border, paddingTop: 10, gap: 4 }}>
            <Text style={{ color: chrome.foreground, fontWeight: "600" }}>{rating.raterName} · {rating.score}/5</Text>
            {rating.comment && <Text style={{ color: chrome.secondaryForeground }}>{rating.comment}</Text>}
            <Text style={{ color: chrome.mutedForeground, fontSize: 12 }}>{rating.createdAt}</Text>
          </View>)}
        </ScrollView>}
      </View>
    </View>
  </Modal>;
}
