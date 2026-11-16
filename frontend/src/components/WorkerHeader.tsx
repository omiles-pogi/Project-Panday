import { Text } from "react-native";
import HomeownerHeader from "@/components/HomeownerHeader";
import { useTheme } from "@/context/ThemeContext";

export default function WorkerHeader({ details = false }: { details?: boolean }) {
  const { chrome } = useTheme();
  if (details) return <HomeownerHeader title="Project Panday" subtitle="Project Details" backTo="/worker/history" />;
  return <HomeownerHeader subtitle="Skilled Worker Account" title={<Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} maxFontSizeMultiplier={1.2}
    style={{ color: chrome.foreground, fontSize: 16, lineHeight: 22, fontWeight: "800" }}>Project Panday</Text>} />;
}
