import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Card, ChipPicker, Field, SubmitButton } from "@/components/ui";
import { fetchWorkLogs, saveWorkLog } from "@/services/api/workerActivity";
import { useFocusedResource } from "@/hooks/useFocusedResource";
import { formatShortDate } from "@/utils/timeline";

/** Entries shown under "Recent entries" before the worker asks for the whole month. */
const RECENT_LOGS = 3;

/** The worker's daily work log on the dashboard: today's entry, and the latest ones before it. */
export default function DailyLogSection() {
  const { data, error, refresh } = useFocusedResource(fetchWorkLogs);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  // null until they start typing, so today's saved entry shows (and stays fresh) until then.
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const projects = data?.projects ?? [];
  const current = projects.find((p) => p.projectId === selectedId) ?? projects[0] ?? null;
  // Two projects can share a name; the id keeps the chips apart.
  const label = (p: { projectId: number; projectTitle: string }) =>
    projects.filter((o) => o.projectTitle === p.projectTitle).length > 1 ? `${p.projectTitle} #${p.projectId}` : p.projectTitle;
  const text = draft ?? current?.todayLog ?? "";
  const logs = data ? (showAll ? data.logs : data.logs.slice(0, RECENT_LOGS)) : [];

  const pick = (name: string) => {
    const next = projects.find((p) => label(p) === name);
    if (!next) return;
    setSelectedId(next.projectId);
    setDraft(null);
    setSaved(false);
    setSaveError(null);
  };

  const save = async () => {
    if (!current || saving) return;
    if (text.trim().length < 3) {
      setSaveError("Write at least a few words about what you did today.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      await saveWorkLog(current.projectId, text.trim());
      setDraft(null);
      setSaved(true);
      await refresh();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not save your log. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="Daily Work Log">
      {error ? <Text className="text-xs text-danger mb-2">{error}</Text> : null}

      {!error && data === null ? (
        <View className="items-center py-4">
          <ActivityIndicator color="#f59e0b" />
        </View>
      ) : null}

      {data && !current ? (
        <Text className="text-xs text-secondary-foreground">{"You aren't on an active project yet, so there's nothing to log."}</Text>
      ) : null}

      {current ? (
        <View style={{ gap: 12 }}>
          <Text className="text-xs text-secondary-foreground">What you worked on today. Your homeowner and contractor can read it.</Text>
          {projects.length > 1 ? (
            <ChipPicker label="Project" options={projects.map(label)} value={label(current)} onChange={pick} />
          ) : (
            <Text className="text-xs font-medium text-foreground">{current.projectTitle}</Text>
          )}
          <Field
            label={current.todayLog ? "Today's log (editing)" : "What did you do today?"}
            multiline
            value={text}
            onChangeText={(v) => {
              setDraft(v);
              setSaved(false);
            }}
            placeholder="e.g. Tied rebar for the ground-floor columns and helped pour two of them."
            maxLength={2000}
          />
          {saveError ? <Text className="text-xs text-danger">{saveError}</Text> : null}
          {saved ? (
            <Text className="text-xs" style={{ color: "#10b981" }}>
              Saved.
            </Text>
          ) : null}
          <SubmitButton label={saving ? "Saving…" : current.todayLog ? "Update log" : "Save log"} onPress={save} />
        </View>
      ) : null}

      {data && data.logs.length > 0 ? (
        <View className="mt-4" style={{ gap: 8 }}>
          <Text className="text-xs font-bold text-foreground">{showAll ? "Last 30 days" : "Recent entries"}</Text>
          {logs.map((log) => (
            <View key={log.id} className="px-3 py-2.5 rounded-xl bg-muted" style={{ gap: 2 }}>
              <Text className="text-xs font-semibold text-foreground">
                {formatShortDate(log.date)} · {log.projectTitle ?? "Project"}
              </Text>
              <Text className="text-xs text-secondary-foreground leading-5">{log.summary}</Text>
            </View>
          ))}
          {data.logs.length > RECENT_LOGS ? (
            <Pressable onPress={() => setShowAll((v) => !v)} className="self-start" hitSlop={8}>
              <Text className="text-xs font-semibold text-primary">{showAll ? "Show fewer" : "Show all entries"}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}
