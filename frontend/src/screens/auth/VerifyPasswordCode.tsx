import { useState } from "react";
import { Pressable, Text } from "react-native";
import { Redirect, router } from "expo-router";
import OtpInput from "@/components/auth/OtpInput";
import { RecoveryButton, RecoveryError, RecoveryScreen, useRecoveryAction, useSecondsRemaining } from "@/components/auth/PasswordRecoveryUI";
import { usePasswordRecovery } from "@/context/PasswordRecoveryContext";
import { forgotPasswordRequest, verifyPasswordResetCodeRequest } from "@/services/api/auth";
import { isValidResetCode } from "@/validators/auth";

export default function VerifyPasswordCode() {
  const { recovery, codeSent, verified } = usePasswordRecovery();
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [resent, setResent] = useState(false);
  const { run, submitting, error } = useRecoveryAction();
  const seconds = useSecondsRemaining(recovery.resendAt);
  if (!recovery.email) return <Redirect href="/forgot-password" />;

  const verify = () => {
    const code = digits.join("");
    if (!isValidResetCode(code)) return;
    void run(async (isActive) => {
      const result = await verifyPasswordResetCodeRequest(recovery.email, code);
      if (!isActive()) return;
      // Only this server response authorizes the password screen. No OTP is passed in a URL.
      verified(result.reset_token, result.expires_in);
      setDigits(Array(6).fill(""));
      router.replace("/create-new-password");
    });
  };

  const resend = () => {
    if (seconds > 0) return;
    void run(async (isActive) => {
      await forgotPasswordRequest(recovery.email);
      if (!isActive()) return;
      codeSent(recovery.email);
      setDigits(Array(6).fill(""));
      setResent(true);
    });
  };

  return (
    <RecoveryScreen title="Verify your code" description="Enter the 6-digit verification code sent to your email.">
      <Text className="text-sm text-muted-foreground mb-6">Sent to: {recovery.email}</Text>
      <OtpInput digits={digits} onChange={setDigits} disabled={submitting} />
      <RecoveryError message={error} />
      <RecoveryButton label={submitting ? "Please wait..." : "Verify Code"} busy={submitting} disabled={!isValidResetCode(digits.join(""))} onPress={verify} />
      {resent && <Text accessibilityLiveRegion="polite" className="text-sm text-muted-foreground mt-4">If your email is registered, a new code is on its way.</Text>}
      <Pressable accessibilityRole="button" disabled={submitting || seconds > 0} onPress={resend} className="mt-5 items-center" style={{ minHeight: 44, justifyContent: "center" }}>
        <Text className="text-primary text-sm font-semibold">{seconds > 0 ? `Resend code in ${seconds}s` : "Resend code"}</Text>
      </Pressable>
    </RecoveryScreen>
  );
}
