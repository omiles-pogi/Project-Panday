import { ActivityIndicator, Modal, Pressable, Text, View } from "react-native";
import Mascot from "@/components/Mascot";

/* NEW PROJECT CONFIRMATION — shown when the homeowner already has projects, so they don't spin up
 * another by accident. Confirming adds it to YOUR PROJECTS right away as "not started yet"; their
 * other projects and their AI chats are untouched. A first-ever project skips this. */
export default function NewProjectModal({
  visible,
  creating,
  projectCount,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  creating: boolean;
  projectCount: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: "rgba(0,0,0,0.65)" }}>
        <View className="w-full rounded-3xl p-6 items-center bg-card border border-border" style={{ maxWidth: 340 }}>
          <Mascot size={88} mood="happy" bob />
          <Text className="text-base font-extrabold mt-3 text-foreground">Create another project?</Text>
          <Text className="text-xs text-center mt-2 leading-5 text-muted-foreground">
            You already have {projectCount} project{projectCount === 1 ? "" : "s"}. Are you sure you want to make a
            new one? It will be added to your projects as &quot;Not started yet&quot; until you plan it with PandAi
            and approve the plan. Your other projects stay exactly as they are.
          </Text>
          <View className="flex-row gap-2 mt-5 w-full">
            <Pressable
              onPress={onCancel}
              disabled={creating}
              className="flex-1 py-2.5 rounded-xl items-center bg-muted border border-border"
            >
              <Text className="text-sm font-semibold text-muted-foreground">Cancel</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              disabled={creating}
              className="flex-1 py-2.5 rounded-xl items-center bg-primary"
              style={{ opacity: creating ? 0.6 : 1 }}
            >
              {creating ? (
                <ActivityIndicator size="small" color="#0f1117" />
              ) : (
                <Text className="text-sm font-bold text-primary-foreground">Yes, Create It</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
