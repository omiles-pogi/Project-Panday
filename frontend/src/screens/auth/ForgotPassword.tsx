import { useState } from "react";
import { Text, TextInput, View, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import KeyboardView from "@/components/KeyboardView";
import KeyboardAwareScrollView from "@/components/KeyboardAwareScrollView";
import Mascot from "@/components/Mascot";
import WaveHeader from "@/components/WaveHeader";
import { forgotPasswordRequest, resetPasswordRequest } from "@/services/api/auth";
import { isValidEmail, isValidResetForm } from "@/validators/auth";

type Step = "email" | "reset" | "done";

export default function ForgotPassword() {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSendCode = isValidEmail(email) && !submitting;
  const canReset = isValidResetForm(code, password, passwordConfirmation) && !submitting;

  const sendCode = async () => {
    if (!canSendCode) return;
    setError(null);
    setSubmitting(true);
    try {
      await forgotPasswordRequest(email.trim());
      setStep("reset");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send the code.");
    } finally {
      setSubmitting(false);
    }
  };

  const resetPassword = async () => {
    if (!canReset) return;
    setError(null);
    setSubmitting(true);
    try {
      await resetPasswordRequest({
        email: email.trim(),
        code: code.trim(),
        password,
        password_confirmation: passwordConfirmation,
      });
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset your password.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <View style={{ paddingTop: insets.top }}>
        <WaveHeader height={160}>
          <Mascot size={90} mood={step === "done" ? "happy" : "thinking"} />
        </WaveHeader>
      </View>

      <KeyboardView className="flex-1">
        <KeyboardAwareScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View className="px-6 pt-6 pb-10">
            {step === "email" && (
              <>
                <Text className="text-2xl font-extrabold text-foreground mb-2">Forgot password?</Text>
                <Text className="text-sm text-muted-foreground mb-6">
                  Enter the email on your account and we&apos;ll send a 6-digit code to reset your password.
                </Text>

                <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />

                {error && <Text className="text-danger text-sm mt-4 text-center">{error}</Text>}

                <Pressable
                  onPress={sendCode}
                  disabled={!canSendCode}
                  className="mt-6 py-3.5 rounded-xl items-center bg-primary"
                  style={{ opacity: canSendCode ? 1 : 0.6 }}
                >
                  <Text className="font-bold text-sm text-primary-foreground">{submitting ? "Sending…" : "Send Code"}</Text>
                </Pressable>
              </>
            )}

            {step === "reset" && (
              <>
                <Text className="text-2xl font-extrabold text-foreground mb-2">Enter the code</Text>
                <Text className="text-sm text-muted-foreground mb-6">
                  If {email} is registered, a 6-digit code just arrived by email. It expires in 15 minutes.
                </Text>

                <View className="gap-3">
                  <Field label="6-digit code" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} />
                  <Field label="New password" value={password} onChangeText={setPassword} secureTextEntry />
                  <Field label="Confirm new password" value={passwordConfirmation} onChangeText={setPasswordConfirmation} secureTextEntry />
                </View>

                {error && <Text className="text-danger text-sm mt-4 text-center">{error}</Text>}

                <Pressable
                  onPress={resetPassword}
                  disabled={!canReset}
                  className="mt-6 py-3.5 rounded-xl items-center bg-primary"
                  style={{ opacity: canReset ? 1 : 0.6 }}
                >
                  <Text className="font-bold text-sm text-primary-foreground">{submitting ? "Resetting…" : "Reset Password"}</Text>
                </Pressable>

                <Pressable onPress={sendCode} disabled={submitting} className="mt-4 items-center">
                  <Text className="text-primary text-sm font-semibold">Resend code</Text>
                </Pressable>
              </>
            )}

            {step === "done" && (
              <>
                <Text className="text-2xl font-extrabold text-foreground mb-2">Password updated</Text>
                <Text className="text-sm text-muted-foreground mb-6">You can now sign in with your new password.</Text>

                <Pressable onPress={() => router.replace("/login")} className="py-3.5 rounded-xl items-center bg-primary">
                  <Text className="font-bold text-sm text-primary-foreground">Back to Sign In</Text>
                </Pressable>
              </>
            )}

            {step !== "done" && (
              <View className="flex-row justify-center mt-6 gap-1">
                <Text className="text-muted-foreground text-sm">Remembered it?</Text>
                <Pressable onPress={() => router.replace("/login")}>
                  <Text className="text-primary text-sm font-semibold">Sign in</Text>
                </Pressable>
              </View>
            )}
          </View>
        </KeyboardAwareScrollView>
      </KeyboardView>
    </View>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: "email-address" | "number-pad";
  autoCapitalize?: "none";
  maxLength?: number;
}) {
  const { label, secureTextEntry, ...inputProps } = props;
  const [hidden, setHidden] = useState(true);
  return (
    <View>
      <Text className="text-xs font-medium text-muted-foreground mb-1.5">{label}</Text>
      <View className="flex-row items-center rounded-xl bg-card border border-border">
        <TextInput
          {...inputProps}
          secureTextEntry={secureTextEntry && hidden}
          placeholderTextColor="#6b7280"
          className="flex-1 px-4 py-3 text-sm text-foreground"
        />
        {secureTextEntry ? (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={hidden ? "Show password" : "Hide password"}
            className="px-4 py-3"
          >
            <Text className="text-xs font-semibold text-muted-foreground">{hidden ? "Show" : "Hide"}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
