import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useFocusEffect } from "expo-router";
import { ActivityIndicator, Pressable, Text, TextInput, View, type TextInputProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import KeyboardView from "@/components/KeyboardView";
import KeyboardAwareScrollView from "@/components/KeyboardAwareScrollView";
import Mascot from "@/components/Mascot";
import WaveHeader from "@/components/WaveHeader";
import { useTheme } from "@/context/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { useValidationColors } from "@/components/auth/PasswordValidation";
import type { ValidationState } from "@/validators/auth";
import { PasswordInputFeedback, usePasswordInput } from "@/components/auth/PasswordInputGuard";

export function RecoveryScreen({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardView className="flex-1 bg-background">
      {/* The header scrolls with the form on small screens, leaving room for the keyboard.
          The existing avoider owns displacement; no second keyboard-height offset is added. */}
      <KeyboardAwareScrollView focusBottomOffset={192} keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top, paddingBottom: Math.max(24, insets.bottom) }}>
        <WaveHeader height={160}><Mascot size={90} mood="happy" /></WaveHeader>
        <View style={{ width: "100%", maxWidth: 440, alignSelf: "center", paddingTop: 24, paddingHorizontal: 24 + Math.max(insets.left, insets.right), paddingBottom: 24 }}>
          <Text className="text-2xl font-extrabold text-foreground mb-2">{title}</Text>
          <Text className="text-sm text-muted-foreground mb-6">{description}</Text>
          {children}
        </View>
      </KeyboardAwareScrollView>
    </KeyboardView>
  );
}

export function RecoveryButton({ label, busy = false, disabled = false, onPress }: { label: string; busy?: boolean; disabled?: boolean; onPress: () => void }) {
  const { chrome } = useTheme();
  const unavailable = disabled || busy;
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: unavailable, busy }} disabled={unavailable} onPress={onPress} className="mt-6 py-3.5 rounded-xl items-center" style={{ minHeight: 48, backgroundColor: unavailable ? chrome.muted : "#f59e0b" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {busy && <ActivityIndicator size="small" color={chrome.mutedForeground} />}
        <Text className="font-bold text-sm" style={{ color: unavailable ? chrome.mutedForeground : "#0f1117" }}>{label}</Text>
      </View>
    </Pressable>
  );
}

export function RecoveryField({ label, secureTextEntry, validationState = "neutral", autoCapitalize = "none", existingPassword = false, allowLegacyWhitespace = false, ...props }: TextInputProps & { label: string; validationState?: ValidationState; existingPassword?: boolean; allowLegacyWhitespace?: boolean }) {
  const { chrome } = useTheme();
  const colors = useValidationColors();
  const [hidden, setHidden] = useState(true);
  const guard = usePasswordInput(props.value ?? "", props.onChangeText, !!secureTextEntry, existingPassword, allowLegacyWhitespace);
  return (
    <View>
      <Text className="text-xs font-medium text-muted-foreground mb-1.5">{label}</Text>
      <View className="flex-row items-center rounded-xl bg-card border" style={{ borderColor: validationState === "neutral" ? chrome.border : colors[validationState] }}>
        <TextInput {...props} onChangeText={guard.onChangeText} accessibilityLabel={label} secureTextEntry={secureTextEntry && hidden} placeholderTextColor={chrome.mutedForeground} autoCorrect={false} autoCapitalize={autoCapitalize} className="flex-1 px-4 py-3 text-sm text-foreground" style={{ minWidth: 0 }} />
        {validationState === "valid" && <Ionicons name="checkmark-circle" size={18} color={colors.valid} />}
        {secureTextEntry && (
          <Pressable onPress={() => setHidden((previous) => !previous)} hitSlop={8} accessibilityRole="button" accessibilityLabel={hidden ? `Show ${label.toLowerCase()}` : `Hide ${label.toLowerCase()}`} className="px-4 py-3">
            <Ionicons name={hidden ? "eye-outline" : "eye-off-outline"} size={19} color={chrome.mutedForeground} />
          </Pressable>
        )}
      </View>
      <PasswordInputFeedback guard={guard} />
    </View>
  );
}

export function RecoveryError({ message }: { message: string | null }) {
  return message ? <Text accessibilityRole="alert" className="text-danger text-sm mt-4">{message}</Text> : null;
}

export function useSecondsRemaining(deadline: number) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

/** An immediate lock blocks double taps; late responses cannot navigate after leaving a screen. */
export function useRecoveryAction() {
  const lock = useRef(false);
  const active = useRef(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useFocusEffect(useCallback(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []));
  const run = async (task: (isActive: () => boolean) => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setSubmitting(true);
    setError(null);
    try {
      await task(() => active.current);
    } catch (err) {
      if (active.current) setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      lock.current = false;
      setSubmitting(false);
    }
  };
  return { run, submitting, error };
}
