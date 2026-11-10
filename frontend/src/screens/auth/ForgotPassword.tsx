import { useState } from "react";
import { router } from "expo-router";
import { RecoveryButton, RecoveryError, RecoveryField, RecoveryScreen, useRecoveryAction } from "@/components/auth/PasswordRecoveryUI";
import { usePasswordRecovery } from "@/context/PasswordRecoveryContext";
import { forgotPasswordRequest } from "@/services/api/auth";
import { isValidEmail } from "@/validators/auth";

export default function ForgotPassword() {
  const { codeSent } = usePasswordRecovery();
  const [email, setEmail] = useState("");
  const { run, submitting, error } = useRecoveryAction();
  const send = () => {
    if (!isValidEmail(email)) return;
    void run(async (isActive) => {
      const address = email.trim().toLowerCase();
      await forgotPasswordRequest(address);
      if (!isActive()) return;
      codeSent(address);
      router.push("/verify-code");
    });
  };
  return (
    <RecoveryScreen title="Forgot password?" description="Enter the email on your account and we'll send a 6-digit code to reset your password.">
      <RecoveryField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" editable={!submitting} onSubmitEditing={send} />
      <RecoveryError message={error} />
      <RecoveryButton label={submitting ? "Sending..." : "Send Code"} busy={submitting} disabled={!isValidEmail(email)} onPress={send} />
    </RecoveryScreen>
  );
}
