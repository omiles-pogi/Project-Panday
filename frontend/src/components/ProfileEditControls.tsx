import { Pressable, Text, View, type TextInputProps } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Field } from "@/components/ui";

export function ProfileEditButton({ editing, disabled, onPress, section }: {
  editing: boolean; disabled?: boolean; onPress: () => void; section: string;
}) {
  return editing ? <Text className="text-xs text-muted-foreground">Editing</Text> : (
    <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${section}`} disabled={disabled}
      onPress={onPress} className="flex-row items-center gap-1.5 px-3 py-2 rounded-xl bg-muted"
      style={{ opacity: disabled ? 0.5 : 1 }}>
      <Ionicons name="pencil-outline" size={15} color="#f59e0b" />
      <Text className="text-xs font-semibold text-foreground">Edit</Text>
    </Pressable>
  );
}

/** Native editing and change handlers are both disabled outside deliberate edit mode. */
export function ProfileField({ editing, saving, style, onChangeText, ...props }: {
  editing: boolean; saving: boolean; label: string;
} & TextInputProps) {
  const editable = editing && !saving;
  return <Field {...props} editable={editable} onChangeText={editable ? onChangeText : undefined}
    style={[editing ? { borderColor: "#f59e0b" } : { opacity: 0.85 }, style]} />;
}

export function ProfileEditActions({ saving, canSave = true, onSave, onCancel, saveLabel = "Save" }: {
  saving: boolean; canSave?: boolean; onSave: () => void; onCancel: () => void; saveLabel?: string;
}) {
  return (
    <View className="flex-row gap-3 mt-1">
      <Pressable accessibilityRole="button" disabled={saving} onPress={onCancel}
        className="flex-1 py-4 rounded-2xl items-center bg-muted" style={{ opacity: saving ? 0.5 : 1 }}>
        <Text className="font-bold text-sm text-foreground">Cancel</Text>
      </Pressable>
      <Pressable accessibilityRole="button" disabled={saving || !canSave} onPress={onSave}
        className="flex-1 py-4 rounded-2xl items-center bg-primary" style={{ opacity: saving || !canSave ? 0.5 : 1 }}>
        <Text className="font-bold text-sm text-primary-foreground">{saving ? "Saving…" : saveLabel}</Text>
      </Pressable>
    </View>
  );
}
