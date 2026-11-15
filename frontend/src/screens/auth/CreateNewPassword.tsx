import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Redirect, router } from "expo-router";
import { RecoveryButton, RecoveryError, RecoveryField, RecoveryScreen, useRecoveryAction, useSecondsRemaining } from "@/components/auth/PasswordRecoveryUI";
import { usePasswordRecovery } from "@/context/PasswordRecoveryContext";
import { resetPasswordRequest } from "@/services/api/auth";
import { ApiError } from "@/services/api/client";
import { confirmationState, isValidPassword, passwordState } from "@/validators/auth";
import PasswordRequirements, { PasswordConfirmation } from "@/components/auth/PasswordValidation";

export default function CreateNewPassword() {
  const { recovery, clear } = usePasswordRecovery();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [passwordEdited, setPasswordEdited] = useState(false);
  const [confirmationEdited, setConfirmationEdited] = useState(false);
  const { run, submitting, error } = useRecoveryAction();
  const remaining = useSecondsRemaining(recovery.authorization?.expiresAt ?? 0);
  // A direct/deep link or app restart has no in-memory server grant. The backend also
  // independently enforces authorization, expiry and single use on every reset request.
  // Clearing the credential while replacing this route must not race its direct-link
  // guard and send a successful reset back to the email form instead of Sign In.
  if (leaving) return null;
  if (!recovery.authorization) return <Redirect href="/forgot-password" />;
  const expired = remaining === 0 || invalid;
  const valid = isValidPassword(password) && password === confirmation && !expired;

  const reset = () => {
    setAttempted(true);
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
        <View>
          <RecoveryField label="New password" value={password} onChangeText={value => { setPassword(value); setPasswordEdited(true); }} secureTextEntry autoComplete="new-password" textContentType="newPassword" editable={!submitting && !expired} validationState={passwordState(password, attempted || passwordEdited)} />
          <PasswordRequirements password={password} attempted={attempted || passwordEdited} />
        </View>
        <View>
          <RecoveryField label="Confirm new password" value={confirmation} onChangeText={value => { setConfirmation(value); setConfirmationEdited(true); }} secureTextEntry autoComplete="new-password" textContentType="newPassword" editable={!submitting && !expired} validationState={confirmationState(password, confirmation, attempted || confirmationEdited)} onSubmitEditing={reset} />
          <PasswordConfirmation password={password} confirmation={confirmation} attempted={attempted || confirmationEdited} />
        </View>
      </View>
      <RecoveryError message={expired ? "Reset authorization has expired or is no longer valid. Request a new code." : error} />
      <RecoveryButton label={submitting ? "Resetting..." : "Reset Password"} busy={submitting} disabled={!valid} onPress={reset} />
      {expired && <Pressable onPress={() => { clear(); router.replace("/forgot-password"); }} className="mt-5 items-center"><Text className="text-primary font-semibold">Request a new code</Text></Pressable>}
      <Pressable accessibilityRole="link" disabled={submitting} onPress={() => { setLeaving(true); clear(); router.replace("/login"); }} className="mt-6 items-center" style={{ minHeight: 44, justifyContent: "center" }}>
        <Text className="text-primary text-sm font-semibold">Back to Sign in</Text>
      </Pressable>
    </RecoveryScreen>
  );
}
