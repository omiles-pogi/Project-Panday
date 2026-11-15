import { useState } from "react";
import { Pressable, Text } from "react-native";
import { passwordInputChange } from "@/validators/auth";

export function usePasswordInput(value: string, onChange: ((value: string) => void) | undefined, passwordField: boolean, existing = false, verifiedLegacy = false) {
  const [error, setError] = useState<string | null>(null);
  const [legacy, setLegacy] = useState(false);
  return {
    error, legacy: verifiedLegacy || legacy,
    offerLegacy: existing && !!error && !legacy && !verifiedLegacy,
    enableLegacy: () => { setLegacy(true); setError(null); },
    onChangeText: (next: string) => {
      const result = passwordField ? passwordInputChange(value, next, verifiedLegacy || legacy) : { accepted: true, value: next, error: null };
      setError(result.error);
      if (result.accepted) onChange?.(result.value);
    },
  };
}

export function PasswordInputFeedback({ guard }: { guard: ReturnType<typeof usePasswordInput> }) {
  return <>
    {guard.error && <Text accessibilityRole="alert" className="text-danger text-xs mt-1">{guard.error}</Text>}
    {guard.offerLegacy && <Pressable accessibilityRole="button" onPress={guard.enableLegacy} style={{ minHeight: 40, justifyContent: "center" }}>
      <Text className="text-primary text-xs">My existing password contains whitespace</Text>
    </Pressable>}
    {guard.legacy && <Text accessibilityLiveRegion="polite" className="text-muted-foreground text-xs mt-1">Existing password mode: enter it exactly, including whitespace. A password update is required before continuing.</Text>}
  </>;
}
