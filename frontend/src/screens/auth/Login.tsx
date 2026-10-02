import { useState } from "react";
import { Text, TextInput, View, Pressable, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { Link } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { isValidLoginForm } from "@/validators/auth";

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = isValidLoginForm(email, password) && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to log in.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }} keyboardShouldPersistTaps="handled">
        <View className="px-6 py-10">
          <View className="items-center mb-10">
            <View className="w-14 h-14 rounded-2xl items-center justify-center mb-4 bg-primary">
              <Text className="text-2xl">🏠</Text>
            </View>
            <Text className="text-2xl font-extrabold text-foreground">Project-Panday</Text>
            <Text className="text-sm text-muted-foreground mt-1">Sign in to your account</Text>
          </View>

          <View className="gap-3">
            <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry />
          </View>

          {error && <Text className="text-danger text-sm mt-4 text-center">{error}</Text>}

          <Pressable
            onPress={handleSubmit}
            disabled={!canSubmit}
            className="mt-6 py-3.5 rounded-xl items-center bg-primary"
            style={{ opacity: canSubmit ? 1 : 0.6 }}
          >
            <Text className="font-bold text-sm text-primary-foreground">
              {submitting ? "Signing in…" : "Sign In"}
            </Text>
          </Pressable>

          <View className="flex-row justify-center mt-6 gap-1">
            <Text className="text-muted-foreground text-sm">Don’t have an account?</Text>
            <Link href="/register" asChild>
              <Pressable>
                <Text className="text-primary text-sm font-semibold">Create one</Text>
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
