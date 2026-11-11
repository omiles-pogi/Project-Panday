import { useEffect, useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import Mascot from "@/components/Mascot";
import { useTheme } from "@/context/ThemeContext";
import { saveProjectName } from "@/services/api/projectNaming";
import type { FinalizedProject, SavedProjectName } from "@/types/project";

/** A deterministic post-save chat step: it never calls the planner or creates a project. */
export default function ProjectNamePrompt({ naming, onSaved }: { naming: SavedProjectName; onSaved: (project: FinalizedProject) => void }) {
  const { chrome } = useTheme();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  const save = async () => {
    if (inFlight.current || !naming.pending) return;
    if (!name.trim()) { setError("Enter a project name."); return; }
    inFlight.current = true;
    setSaving(true);
    setError(null);
    try {
      const saved = await saveProjectName(naming.projectId, name);
      if (active.current) onSaved(saved);
    } catch (failure) {
      if (active.current) setError(failure instanceof Error ? failure.message : "Couldn't save the project name. Try again.");
    } finally {
      inFlight.current = false;
      if (active.current) setSaving(false);
    }
  };

  return (
    <View className="flex-row gap-3 items-start mb-4">
      <Mascot size={44} mood="happy" />
      <View className="flex-1" style={{ gap: 10 }}>
        <View className="rounded-2xl px-4 py-3 bg-card border border-border" accessibilityLiveRegion="polite">
          <Text className="text-sm leading-relaxed text-card-foreground">
            {naming.pending ? "Your construction plan has been finalized successfully! What would you like to name your project?" : `Your project name has been saved as “${naming.title}”.`}
          </Text>
        </View>
        {naming.pending && <View className="rounded-2xl p-4 bg-card border border-border" style={{ gap: 10 }}>
          <Text className="text-xs font-semibold text-foreground">Project name</Text>
          <TextInput value={name} onChangeText={setName} placeholder="e.g., Padlan Residence" placeholderTextColor={chrome.mutedForeground}
            accessibilityLabel="Project name" editable={!saving} maxLength={255} autoCapitalize="words" returnKeyType="done"
            onSubmitEditing={() => void save()} className="rounded-xl border border-border bg-muted px-3 py-3 text-sm text-foreground" />
          {error && <Text className="text-xs text-danger" accessibilityLiveRegion="polite">{error}</Text>}
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: saving || !name.trim(), busy: saving }}
            disabled={saving || !name.trim()} onPress={() => void save()} className="rounded-xl bg-primary py-3 items-center"
            style={{ opacity: saving || !name.trim() ? 0.6 : 1 }}>
            <Text className="text-sm font-bold text-primary-foreground">{saving ? "Saving..." : "Save Project Name"}</Text>
          </Pressable>
        </View>}
      </View>
    </View>
  );
}
