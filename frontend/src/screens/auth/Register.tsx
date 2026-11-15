import { useRef, useState } from "react";
import { ActivityIndicator, Text, View, Pressable } from "react-native";
import KeyboardView from "@/components/KeyboardView";
import KeyboardAwareScrollView from "@/components/KeyboardAwareScrollView";
import { Link } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import Logo from "@/components/Logo";
import { roleColors } from "@/theme/colors";
import type { Role } from "@/types/auth";
import { confirmationState, isValidRegisterForm, passwordState, VERIFICATION_FIELDS } from "@/validators/auth";
import { RecoveryField as Field } from "@/components/auth/PasswordRecoveryUI";
import PasswordRequirements, { PasswordConfirmation } from "@/components/auth/PasswordValidation";

const ROLE_OPTIONS: { id: Role; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: "homeowner", label: "Homeowner", icon: "home-outline" },
  { id: "contractor", label: "Contractor", icon: "business-outline" },
  { id: "supplier", label: "Supplier", icon: "cube-outline" },
  { id: "worker", label: "Skilled Worker", icon: "hammer-outline" },
];

export default function Register() {
  const { register } = useAuth();
  const { chrome } = useTheme();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [role, setRole] = useState<Role>("homeowner");
  const [businessName, setBusinessName] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [passwordEdited, setPasswordEdited] = useState(false);
  const [confirmationEdited, setConfirmationEdited] = useState(false);
  const requestInFlight = useRef(false);

  const verification = VERIFICATION_FIELDS[role];

  const canSubmit = isValidRegisterForm({
      name,
      email,
      password,
      passwordConfirmation,
      role,
      businessName,
      licenseNumber,
    }) && !submitting;

  const handleSubmit = async () => {
    if (requestInFlight.current) return;
    setAttempted(true);
    if (!canSubmit) return;
    // State updates alone cannot block a second tap before React's next render.
    requestInFlight.current = true;
    setError(null);
    setSubmitting(true);
    try {
      await register({
        name: name.trim(),
        email: email.trim(),
        password,
        password_confirmation: passwordConfirmation,
        role,
        ...(verification
          ? {
              business_name: verification.businessLabel ? businessName.trim() : undefined,
              license_number: licenseNumber.trim(),
            }
          : {}),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to register.");
    } finally {
      requestInFlight.current = false;
      setSubmitting(false);
    }
  };

  return (
    <KeyboardView className="flex-1 bg-background">
      <KeyboardAwareScrollView focusBottomOffset={192} contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View className="px-6 py-10">
          <View className="items-center mb-8">
            <View className="mb-4">
              <Logo size={130} />
            </View>
            <Text className="text-2xl font-extrabold text-foreground">Create your account</Text>
          </View>

          <Text className="text-xs font-medium text-muted-foreground mb-2">I am a...</Text>
          <View className="flex-row flex-wrap gap-2 mb-5">
            {ROLE_OPTIONS.map((opt) => {
              const active = role === opt.id;
              const color = roleColors[opt.id];
              return (
                <Pressable
                  key={opt.id}
                  disabled={submitting}
                  onPress={() => setRole(opt.id)}
                  className="rounded-xl px-4 py-3 flex-row items-center gap-2 border"
                  style={{
                    flexGrow: 1, flexBasis: "45%",
                    backgroundColor: active ? `${color}20` : chrome.card,
                    borderColor: active ? color : chrome.border,
                  }}
                >
                  <Ionicons name={opt.icon} size={18} color={active ? color : chrome.mutedForeground} />
                  <Text
                    className="text-xs font-semibold flex-shrink"
                    style={{ color: active ? color : chrome.mutedForeground }}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View className="gap-3">
            <Field label="Name" placeholder="Full name" value={name} onChangeText={setName} autoComplete="name" autoCapitalize="words" editable={!submitting} maxLength={255} />
            <Field label="Email" placeholder="Registered email" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" editable={!submitting} maxLength={255} />
            <View>
              <Field label="Password" value={password} onChangeText={value => { setPassword(value); setPasswordEdited(true); }} secureTextEntry autoComplete="new-password" editable={!submitting} validationState={passwordState(password, attempted || passwordEdited)} />
              <PasswordRequirements password={password} attempted={attempted || passwordEdited} />
            </View>
            <View>
              <Field label="Confirm password" value={passwordConfirmation} onChangeText={value => { setPasswordConfirmation(value); setConfirmationEdited(true); }} secureTextEntry autoComplete="new-password" editable={!submitting} validationState={confirmationState(password, passwordConfirmation, attempted || confirmationEdited)} onSubmitEditing={() => void handleSubmit()} />
              <PasswordConfirmation password={password} confirmation={passwordConfirmation} attempted={attempted || confirmationEdited} />
            </View>
          </View>

          {verification ? (
            <View className="mt-5 gap-3">
              <Text className="text-xs font-semibold text-primary">
                Verification — an admin reviews these before your account is approved
              </Text>
              {verification.businessLabel ? (
                <Field label={verification.businessLabel} value={businessName} onChangeText={setBusinessName} editable={!submitting} />
              ) : null}
              <Field
                label={verification.licenseLabel}
                value={licenseNumber}
                onChangeText={setLicenseNumber}
                placeholder={verification.licenseHint}
                autoCapitalize="characters"
                editable={!submitting}
              />
            </View>
          ) : null}

          {error && <Text className="text-danger text-sm mt-4 text-center">{error}</Text>}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Create Account"
            accessibilityState={{ disabled: !canSubmit, busy: submitting }}
            onPress={handleSubmit}
            disabled={!canSubmit}
            className="mt-6 py-3.5 rounded-xl items-center flex-row justify-center gap-2"
            style={{ backgroundColor: canSubmit ? "#f59e0b" : chrome.muted, minHeight: 48 }}
          >
            {submitting && <ActivityIndicator size="small" color={chrome.mutedForeground} />}
            <Text className="font-bold text-sm" style={{ color: canSubmit ? "#0f1117" : chrome.mutedForeground }}>
              {submitting ? "Creating account…" : "Create Account"}
            </Text>
          </Pressable>

          <View className="flex-row justify-center mt-6 gap-1">
            <Text className="text-muted-foreground text-sm">Already have an account?</Text>
            <Link href="/login" asChild>
              <Pressable>
                <Text className="text-primary text-sm font-semibold">Sign in</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </KeyboardAwareScrollView>
    </KeyboardView>
  );
}
