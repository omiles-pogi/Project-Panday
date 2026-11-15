import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/context/ThemeContext";
import { confirmationError, confirmationState, passwordError, passwordRequirements } from "@/validators/auth";

export function useValidationColors() {
  const { mode, chrome } = useTheme();
  return { neutral: chrome.mutedForeground, invalid: mode === "dark" ? "#f87171" : "#b91c1c", valid: mode === "dark" ? "#4ade80" : "#15803d" };
}

export default function PasswordRequirements({ password, attempted = false }: { password: string; attempted?: boolean }) {
  const colors = useValidationColors();
  const started = password.length > 0 || attempted;
  const error = started ? passwordError(password) : null;
  return <View style={{ gap: 6, marginTop: 10 }}>
    <Text className="text-xs font-semibold text-secondary-foreground">Password requirements</Text>
    {passwordRequirements(password).map(requirement => {
      const color = colors[started ? requirement.met ? "valid" : "invalid" : "neutral"];
      return <View key={requirement.label} style={{ flexDirection: "row", alignItems: "flex-start", gap: 6 }}>
        <Ionicons name={!started ? "ellipse-outline" : requirement.met ? "checkmark-circle" : "alert-circle"} size={15} color={color} />
        <Text style={{ flex: 1, color, fontSize: 12, lineHeight: 17 }}>{requirement.label}</Text>
      </View>;
    })}
    {error && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ color: colors.invalid, fontSize: 12, lineHeight: 17 }}>{error}</Text>}
  </View>;
}

export function PasswordConfirmation({ password, confirmation, attempted = false }: { password: string; confirmation: string; attempted?: boolean }) {
  const colors = useValidationColors();
  const state = confirmationState(password, confirmation, attempted);
  if (state === "neutral") return null;
  const valid = state === "valid";
  return <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: 8 }}>
    <Ionicons name={valid ? "checkmark-circle" : "alert-circle"} color={colors[state]} size={15} />
    <Text accessibilityRole={valid ? undefined : "alert"} accessibilityLiveRegion="polite" style={{ flex: 1, color: colors[state], fontSize: 12, lineHeight: 17 }}>
      {valid ? "Passwords match." : confirmationError(password, confirmation)}
    </Text>
  </View>;
}
