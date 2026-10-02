import { useState } from "react";
import { Text, TextInput, View, Pressable, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { Link } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { roleColors } from "@/theme/colors";
import type { Role } from "@/types/auth";
import { isValidRegisterForm } from "@/validators/auth";

const ROLE_OPTIONS: { id: Role; label: string; icon: string }[] = [
  { id: "homeowner", label: "Homeowner", icon: "🏠" },
  { id: "contractor", label: "Contractor", icon: "🏗️" },
  { id: "supplier", label: "Supplier", icon: "📦" },
  { id: "worker", label: "Skilled Worker", icon: "👷" },
];

export default function Register() {
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [role, setRole] = useState<Role>("homeowner");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = isValidRegisterForm({ name, email, password, passwordConfirmation }) && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      await register({
        name: name.trim(),
        email: email.trim(),
        password,
        password_confirmation: passwordConfirmation,
        role,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to register.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView className="flex-1 bg-background" behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View className="px-6 py-10">
          <View className="items-center mb-8">
            <View className="w-14 h-14 rounded-2xl items-center justify-center mb-4 bg-primary">
              <Text className="text-2xl">🏠</Text>
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
                  onPress={() => setRole(opt.id)}
                  className="rounded-xl px-4 py-3 flex-row items-center gap-2 border"
                  style={{
                    width: "47%",
                    backgroundColor: active ? `${color}20` : "#1a1d27",
                    borderColor: active ? color : "#2a2f42",
                  }}
                >
                  <Text className="text-lg">{opt.icon}</Text>
                  <Text
                    className="text-xs font-semibold flex-shrink"
                    style={{ color: active ? color : "#9ca3af" }}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View className="gap-3">
            <Field label="Name" value={name} onChangeText={setName} />
            <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry />
            <Field
              label="Confirm password"
              value={passwordConfirmation}
              onChangeText={setPasswordConfirmation}
              secureTextEntry
            />
          </View>

          {error && <Text className="text-danger text-sm mt-4 text-center">{error}</Text>}

          <Pressable
            onPress={handleSubmit}
            disabled={!canSubmit}
            className="mt-6 py-3.5 rounded-xl items-center bg-primary"
            style={{ opacity: canSubmit ? 1 : 0.6 }}
          >
            <Text className="font-bold text-sm text-primary-foreground">
              {submitting ? "Creating account…" : "Create Account"}
            </Text>
          </Pressable>

          <View className="flex-row justify-center mt-6 gap-1">
            <Text className="text-muted-foreground text-sm">Already have an account?</Text>
            <Link href="/" asChild>
              <Pressable>
                <Text className="text-primary text-sm font-semibold">Sign in</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: "email-address";
  autoCapitalize?: "none";
}) {
  const { label, ...inputProps } = props;
  return (
    <View>
      <Text className="text-xs font-medium text-muted-foreground mb-1.5">{label}</Text>
      <TextInput
        {...inputProps}
        placeholderTextColor="#6b7280"
        className="rounded-xl px-4 py-3 text-sm bg-card border border-border text-foreground"
      />
    </View>
  );
}
