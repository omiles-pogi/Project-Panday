import { Text, View } from "react-native";
import { usePlan } from "@/context/PlanContext";
import { useTheme } from "@/context/ThemeContext";

/** Name belongs to the active conversation, rather than the last plan generated on the device. */
export default function PlannerTitle() {
  const { activeProjectKey, activeProjectTitle } = usePlan();
  const { chrome } = useTheme();
  const title = activeProjectTitle || (/^\d+$/.test(activeProjectKey) ? `Project #${activeProjectKey}` : "Select a project");
  return <View style={{ minWidth: 0 }}>
    <Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={{ color: chrome.foreground, fontSize: 20, lineHeight: 26, fontWeight: "800" }}>PandAI</Text>
    <Text numberOfLines={1} maxFontSizeMultiplier={1.2} adjustsFontSizeToFit minimumFontScale={0.75}
      style={{ color: chrome.secondaryForeground, fontSize: 12, lineHeight: 17 }}>{title}</Text>
  </View>;
}
