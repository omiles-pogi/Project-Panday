import { useRef, useState } from "react";
import { Text, View, type TextInputProps } from "react-native";
import { Card, Field, SubmitButton } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { ProfileEditActions, ProfileEditButton, ProfileField } from "@/components/ProfileEditControls";

/**
 * Lets any signed-in user change their own name. It sits on every role's profile, and the new name
 * shows up straight away in the side menu, the greetings and the profile header.
 */
export default function NameCard({ hint = "The name other people see on your account.", requireEdit = false, saveLabel = "Save" }: { hint?: string; requireEdit?: boolean; saveLabel?: string }) {
  const { user, updateName } = useAuth();
  // null until they start typing, so the field follows the saved name until then.
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState(false);
  const inFlight = useRef(false);

  const value = draft ?? user?.name ?? "";
  const fieldProps: { label: string } & TextInputProps = {
    label: "Full name", value, maxLength: 255, autoCapitalize: "words", placeholder: "e.g. Juan dela Cruz",
    onChangeText: (text) => {
      if (requireEdit && (!editing || inFlight.current)) return;
      setDraft(text);
      setSaved(false);
    },
  };

  const save = async () => {
    if (inFlight.current || (requireEdit && !editing)) return;
    const name = value.trim();
    if (name.length < 2) {
      setError("Your name needs at least 2 characters.");
      return;
    }
    if (name === user?.name) {
      setDraft(null);
      setError(null);
      setEditing(false);
      return;
    }
    inFlight.current = true;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await updateName(name);
      setDraft(null);
      setSaved(true);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change your name. Try again.");
    } finally {
      setSaving(false);
      inFlight.current = false;
    }
  };

  return (
    <Card title="Your name" right={requireEdit ? <ProfileEditButton editing={editing} section="your name" onPress={() => {
      setDraft(null); setError(null); setSaved(false); setEditing(true);
    }} /> : undefined}>
      <Text className="text-xs mb-3 text-muted-foreground">{hint}</Text>
      {requireEdit ? <ProfileField {...fieldProps} editing={editing} saving={saving} /> : <Field {...fieldProps} />}
      {error ? <Text className="text-xs mt-2 text-danger">{error}</Text> : null}
      {saved ? (
        <Text className="text-xs mt-2" style={{ color: "#10b981" }}>
          Name updated.
        </Text>
      ) : null}
      {requireEdit ? editing && <View className="mt-3">
        <ProfileEditActions saving={saving} saveLabel={saveLabel} onSave={save} onCancel={() => {
          if (inFlight.current) return;
          setDraft(null); setError(null); setEditing(false);
        }} />
      </View> : <View className="mt-3">
        <SubmitButton label={saving ? "Saving…" : "Save name"} onPress={save} />
      </View>}
    </Card>
  );
}
