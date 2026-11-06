import { useState } from "react";
import { Text, TextInput, View, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import KeyboardView from "@/components/KeyboardView";
import KeyboardAwareScrollView from "@/components/KeyboardAwareScrollView";
import { Link } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import Mascot from "@/components/Mascot";
import WaveHeader from "@/components/WaveHeader";
import { isValidLoginForm } from "@/validators/auth";

export default function Login() {
  const { login, prefillEmail } = useAuth();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState(prefillEmail);
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
    <View className="flex-1 bg-background">
      <View style={{ paddingTop: insets.top }}>
        <WaveHeader height={160}>
          <Mascot size={90} mood="happy" />
        </WaveHeader>
      </View>

      <KeyboardView className="flex-1">
        <KeyboardAwareScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View className="px-6 pt-6 pb-10">
            <Text className="text-2xl font-extrabold text-foreground mb-6">Sign in</Text>

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
  keyboardType?: "email-address";
  autoCapitalize?: "none";
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
