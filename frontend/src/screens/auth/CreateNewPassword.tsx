import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Redirect, router } from "expo-router";
import { RecoveryButton, RecoveryError, RecoveryField, RecoveryScreen, useRecoveryAction, useSecondsRemaining } from "@/components/auth/PasswordRecoveryUI";
import { usePasswordRecovery } from "@/context/PasswordRecoveryContext";
import { resetPasswordRequest } from "@/services/api/auth";
import { ApiError } from "@/services/api/client";
import { isValidPassword } from "@/validators/auth";

export default function CreateNewPassword() {
  const { recovery, clear } = usePasswordRecovery();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const { run, submitting, error } = useRecoveryAction();
  const remaining = useSecondsRemaining(recovery.authorization?.expiresAt ?? 0);
  // A direct/deep link or app restart has no in-memory server grant. The backend also
  // independently enforces authorization, expiry and single use on every reset request.
  // Clearing the credential while replacing this route must not race its direct-link
  // guard and send a successful reset back to the email form instead of Sign In.
  if (leaving) return null;
  if (!recovery.authorization) return <Redirect href="/forgot-password" />;
  const expired = remaining === 0 || invalid;
  const mismatched = confirmation.length > 0 && password !== confirmation;
  const valid = isValidPassword(password) && password === confirmation && !expired;

  const reset = () => {
    if (!valid) return;
    void run(async (isActive) => {
      try {
        await resetPasswordRequest({ email: recovery.email, reset_token: recovery.authorization!.token, password, password_confirmation: confirmation });
      } catch (err) {
        const fields = err instanceof ApiError ? (err.data as { errors?: Record<string, string[]> } | null)?.errors : null;
        if (isActive() && fields?.reset_token) setInvalid(true);
        throw err;
      }
      if (!isActive()) return;
      setPassword("");
      setConfirmation("");
      setLeaving(true);
      clear();
      router.replace({ pathname: "/login", params: { passwordReset: "success" } });
    });
  };

  return (
    <RecoveryScreen title="Create new password" description="Your code is verified. Set your new password below.">
      <View className="gap-4">
        <RecoveryField label="New password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword" editable={!submitting && !expired} />
        <RecoveryField label="Confirm new password" value={confirmation} onChangeText={setConfirmation} secureTextEntry autoComplete="new-password" textContentType="newPassword" editable={!submitting && !expired} />
      </View>
      <Text className="text-xs text-muted-foreground mt-3">Use at least 8 characters.</Text>
      <RecoveryError message={expired ? "Reset authorization has expired or is no longer valid. Request a new code." : error ?? (mismatched ? "Passwords do not match." : null)} />
      <RecoveryButton label={submitting ? "Resetting..." : "Reset Password"} busy={submitting} disabled={!valid} onPress={reset} />
      {expired && <Pressable onPress={() => { clear(); router.replace("/forgot-password"); }} className="mt-5 items-center"><Text className="text-primary font-semibold">Request a new code</Text></Pressable>}
      <Pressable accessibilityRole="link" disabled={submitting} onPress={() => { setLeaving(true); clear(); router.replace("/login"); }} className="mt-6 items-center" style={{ minHeight: 44, justifyContent: "center" }}>
        <Text className="text-primary text-sm font-semibold">Back to Sign in</Text>
      </Pressable>
    </RecoveryScreen>
  );
}
