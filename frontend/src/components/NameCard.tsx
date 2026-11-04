import { useState } from "react";
import { Text, View } from "react-native";
import { Card, Field, SubmitButton } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";

/**
 * Lets any signed-in user change their own name. It sits on every role's profile, and the new name
 * shows up straight away in the side menu, the greetings and the profile header.
 */
export default function NameCard({ hint = "The name other people see on your account." }: { hint?: string }) {
  const { user, updateName } = useAuth();
  // null until they start typing, so the field follows the saved name until then.
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const value = draft ?? user?.name ?? "";

  const save = async () => {
    if (saving) return;
    const name = value.trim();
    if (name.length < 2) {
      setError("Your name needs at least 2 characters.");
      return;
    }
    if (name === user?.name) {
      setDraft(null);
      setError(null);
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await updateName(name);
      setDraft(null);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change your name. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="Your name">
      <Text className="text-xs mb-3 text-muted-foreground">{hint}</Text>
      <Field
        label="Full name"
        value={value}
        onChangeText={(text) => {
          setDraft(text);
          setSaved(false);
        }}
        maxLength={255}
        autoCapitalize="words"
        placeholder="e.g. Juan dela Cruz"
      />
      {error ? <Text className="text-xs mt-2 text-danger">{error}</Text> : null}
      {saved ? (
        <Text className="text-xs mt-2" style={{ color: "#10b981" }}>
          Name updated.
        </Text>
      ) : null}
      <View className="mt-3">
        <SubmitButton label={saving ? "Saving…" : "Save name"} onPress={save} />
      </View>
    </Card>
  );
}
