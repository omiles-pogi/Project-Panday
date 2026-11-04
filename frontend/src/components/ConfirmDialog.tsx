import { useCallback, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import Mascot, { type MascotMood } from "@/components/Mascot";
import type { IconName } from "@/components/ui";

export interface ConfirmOptions {
  title: string;
  message: string;
  /** A short line saying what it's about — "Site Preparation · 3 tasks", a project's name, a price. */
  detail?: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** PandAi's face: happy for going ahead, thinking for "are you sure?", sad when it's destructive. */
  mood?: MascotMood;
  /** "danger" turns the confirm button red, for things that cancel or undo work. */
  tone?: "primary" | "danger";
  /** Shown on the confirm button. */
  icon?: IconName;
  onConfirm: () => void;
}

/**
 * A confirmation in the app's own style — PandAi on a dark card, like the delete-project and
 * new-project prompts — instead of the phone's plain system alert. Use it through useConfirmDialog().
 */
function ConfirmDialog({ options, visible, onCancel, onConfirm }: { options: ConfirmOptions | null; visible: boolean; onCancel: () => void; onConfirm: () => void }) {
  const danger = options?.tone === "danger";
  const accent = danger ? "#ef4444" : "#f59e0b";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: "rgba(0,0,0,0.65)" }}>
        <Animated.View entering={ZoomIn.duration(220)} className="w-full rounded-3xl p-6 items-center bg-card border border-border" style={{ maxWidth: 340 }}>
          {/* A soft glow behind PandAi, tinted to the kind of question being asked. */}
          <View className="items-center justify-center rounded-full" style={{ width: 116, height: 116, backgroundColor: `${accent}18` }}>
            <Mascot size={92} mood={options?.mood ?? "happy"} bob />
          </View>

          <Text className="text-base font-extrabold mt-3 text-center text-foreground">{options?.title}</Text>

          {options?.detail ? (
            <View className="mt-2 px-3 py-1 rounded-full" style={{ backgroundColor: `${accent}1f` }}>
              <Text className="text-xs font-bold text-center" style={{ color: accent }}>
                {options.detail}
              </Text>
            </View>
          ) : null}

          <Text className="text-xs text-center mt-3 leading-5 text-muted-foreground">{options?.message}</Text>

          <View className="flex-row gap-2 mt-5 w-full">
            <Pressable onPress={onCancel} className="flex-1 py-2.5 rounded-xl items-center justify-center bg-muted border border-border" accessibilityRole="button">
              <Text className="text-sm font-semibold text-muted-foreground">{options?.cancelLabel ?? "Cancel"}</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              className="flex-1 py-2.5 rounded-xl items-center justify-center flex-row gap-1.5"
              style={{ backgroundColor: accent }}
              accessibilityRole="button"
            >
              {options?.icon ? <Ionicons name={options.icon} size={14} color={danger ? "#fff" : "#0f1117"} /> : null}
              <Text className="text-sm font-bold" style={{ color: danger ? "#fff" : "#0f1117" }}>
                {options?.confirmLabel}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

/**
 * `const { ask, dialog } = useConfirmDialog();` — call `ask({...})` where you'd have called
 * `Alert.alert`, and render `{dialog}` once in the component. The dialog closes before `onConfirm`
 * runs, so the action shows its own progress on the screen.
 */
export function useConfirmDialog() {
  // The options stay put while the dialog fades out, so it doesn't go blank on its way off.
  const [state, setState] = useState<{ options: ConfirmOptions | null; visible: boolean }>({ options: null, visible: false });

  const ask = useCallback((options: ConfirmOptions) => setState({ options, visible: true }), []);
  const close = useCallback(() => setState((current) => ({ ...current, visible: false })), []);

  const dialog = (
    <ConfirmDialog
      options={state.options}
      visible={state.visible}
      onCancel={close}
      onConfirm={() => {
        const run = state.options?.onConfirm;
        close();
        run?.();
      }}
    />
  );

  return { ask, dialog };
}
