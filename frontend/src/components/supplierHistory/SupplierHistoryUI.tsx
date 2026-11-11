import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import HomeownerHeader from "@/components/HomeownerHeader";
import { useTheme } from "@/context/ThemeContext";
import { MAX_CONTENT_WIDTH } from "@/components/ui";
import type { SupplierHistoryProject } from "@/types/supplierHistory";
import { supplyDate, supplyMoney } from "@/utils/supplierHistory";

export function SupplierHistoryHeader({ title, subtitle, backTo }: { title: string; subtitle?: string; backTo?: string }) {
  const { chrome } = useTheme();
  const { width } = useWindowDimensions();
  return <HomeownerHeader title={<Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} maxFontSizeMultiplier={1.2}
    style={{ color: chrome.foreground, fontSize: width < 350 ? 16 : 20, lineHeight: 26, fontWeight: "800" }}>{title}</Text>} subtitle={subtitle}
    left={backTo ? <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={8}
      onPress={() => router.canGoBack() ? router.back() : router.replace(backTo as never)}
      style={{ width: 36, height: 40, alignItems: "center", justifyContent: "center" }}>
      <Ionicons name="arrow-back" size={24} color={chrome.foreground} />
    </Pressable> : undefined} />;
}

export function useSupplierHistorySpacing() {
  const insets = useSafeAreaInsets();
  return { paddingTop: 16, paddingBottom: insets.bottom + 16, paddingLeft: insets.left + 16, paddingRight: insets.right + 16,
    gap: 16, width: "100%" as const, maxWidth: MAX_CONTENT_WIDTH, alignSelf: "center" as const, flexGrow: 1 };
}

export function SupplyCard({ children }: { children: ReactNode }) {
  const { chrome } = useTheme();
  return <View style={[styles.card, { backgroundColor: chrome.card, borderColor: chrome.border }]}>{children}</View>;
}

export function SupplierProjectSummary({ project, onPress }: { project: SupplierHistoryProject; onPress?: () => void }) {
  const { chrome } = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const stacked = width < 350 || fontScale > 1.3;
  const contents = <SupplyCard>
    <View style={{ flexDirection: stacked ? "column" : "row", gap: 14 }}>
      {/* No stored project photo exists: this neutral placeholder never represents a real site photo. */}
      <View style={{ width: stacked ? "100%" : 78, minHeight: stacked ? 72 : 112, borderRadius: 16,
        backgroundColor: chrome.muted, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="home-outline" size={34} color={chrome.secondaryForeground} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ color: chrome.foreground, fontSize: 17, fontWeight: "800", flex: 1 }}>{project.title}</Text>
          {onPress && <Ionicons name="chevron-forward" size={18} color={chrome.secondaryForeground} />}
        </View>
        <Text style={{ color: chrome.secondaryForeground, fontSize: 12, lineHeight: 18 }}>{project.homeownerName} · Homeowner</Text>
        <Text style={{ color: chrome.secondaryForeground, fontSize: 12 }}>{supplyDate(project.lastReceivedAt)}</Text>
        <Text style={{ color: chrome.foreground, fontSize: 17, fontWeight: "800" }}>{supplyMoney(project.totalAmount)}</Text>
      </View>
    </View>
  </SupplyCard>;
  return onPress ? <Pressable accessibilityRole="button" accessibilityLabel={`View supply history for ${project.title}`} onPress={onPress}>{contents}</Pressable> : contents;
}

export function SupplyHistoryFeedback({ title, message, retry }: { title: string; message: string; retry?: () => void }) {
  const { chrome } = useTheme();
  return <SupplyCard><View style={{ alignItems: "center", gap: 12 }} accessibilityLiveRegion="polite">
    <Ionicons name={retry ? "alert-circle-outline" : "cube-outline"} size={38} color={chrome.secondaryForeground} />
    <Text style={{ color: chrome.foreground, fontSize: 17, fontWeight: "700", textAlign: "center" }}>{title}</Text>
    <Text style={{ color: chrome.secondaryForeground, fontSize: 13, lineHeight: 20, textAlign: "center" }}>{message}</Text>
    {retry && <Pressable accessibilityRole="button" onPress={retry} style={styles.action}>
      <Text style={{ color: "#0f1117", fontWeight: "700" }}>Retry</Text>
    </Pressable>}
  </View></SupplyCard>;
}

export function SupplyRow({ label, value }: { label: string; value: string }) {
  const { chrome } = useTheme();
  return <View style={{ gap: 4 }}>
    <Text style={{ color: chrome.secondaryForeground, fontSize: 12 }}>{label}</Text>
    <Text style={{ color: chrome.foreground, fontSize: 14, lineHeight: 20 }}>{value}</Text>
  </View>;
}

export const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 22, padding: 16, gap: 14, shadowColor: "#111827", shadowOpacity: 0.05,
    shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  action: { paddingHorizontal: 16, paddingVertical: 13, minHeight: 44, borderRadius: 14, backgroundColor: "#f59e0b", alignItems: "center", justifyContent: "center" },
});
