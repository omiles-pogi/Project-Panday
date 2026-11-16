import { useEffect, useRef, useState } from "react";
import { Pressable, Text } from "react-native";
import { Button, Card, Field } from "@/components/ui";
import Sheet from "@/components/Sheet";
import { saveWorkLog, type WorkLog } from "@/services/api/workerActivity";
import { workLogDateError } from "@/utils/workerProjects";
import { workerHistoryDate } from "@/utils/workerHistory";

/** Presentation and the existing per-day upsert only; the project screen owns all refreshes. */
export default function ProjectWorkLogs({ projectId, logs, today, readOnly, error, onChanged }: {
  projectId: number; logs: WorkLog[]; today: string | null; readOnly: boolean; error: string | null; onChanged: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [viewing, setViewing] = useState<WorkLog | null>(null);
  const [date, setDate] = useState("");
  const [summary, setSummary] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const busy = useRef(false);
  const alive = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const start = () => {
    if (readOnly || !today || error || busy.current) return;
    setDate(today); setSummary(logs.find(log => log.date === today)?.summary ?? ""); setSaveError(null); setEditing(true);
  };
  const changeDate = (value: string) => {
    // Preserve newly typed work when its date changes, without copying a saved
    // day's text into another day automatically.
    if (!summary || summary === logs.find(log => log.date === date)?.summary) setSummary(logs.find(log => log.date === value)?.summary ?? "");
    setDate(value); setSaveError(null);
  };
  const save = async () => {
    if (readOnly || !today || busy.current) return;
    const invalid = workLogDateError(date, today);
    if (invalid || summary.trim().length < 3 || summary.trim().length > 2000) { setSaveError(invalid ?? "Describe your work using 3 to 2,000 characters."); return; }
    busy.current = true; setSaving(true); setSaveError(null);
    try {
      const log = await saveWorkLog(projectId, summary.trim(), date);
      if (!alive.current) return;
      if (log.projectId !== projectId) throw new Error("The saved log did not match this project. Please refresh.");
      setEditing(false); await onChanged();
    } catch (failure) {
      if (alive.current) setSaveError(failure instanceof Error ? failure.message : "Your log could not be saved. Please retry.");
    } finally {
      busy.current = false; if (alive.current) setSaving(false);
    }
  };
  return <>
    <Card title="Daily Work Logs" gap={10}>
      <Text className="text-xs text-muted-foreground">Your recorded work activities for this project.</Text>
      {!readOnly && <Button label="Add Work Log" onPress={start} disabled={!today || !!error || saving} />}
      {error ? <Text accessibilityRole="alert" className="text-xs text-danger">{error}</Text> : !logs.length ? <Text className="text-sm text-muted-foreground">No work logs recorded for this project yet.</Text> : null}
      {logs.map(log => <Pressable key={`project-${projectId}-log-${log.id}`} accessibilityRole="button" accessibilityLabel={`View work log for ${log.date}`}
        onPress={() => setViewing(log)} className="rounded-xl bg-muted p-3" style={{ gap: 5 }}>
        <Text className="text-xs font-bold text-foreground">{workerHistoryDate(log.date)}</Text>
        <Text className="text-sm text-secondary-foreground" numberOfLines={3}>{log.summary}</Text>
      </Pressable>)}
    </Card>
    {editing && !readOnly && <Sheet visible title="Add Work Log" onClose={() => { if (!busy.current) setEditing(false); }}>
      <Field label="Work date (YYYY-MM-DD)" value={date} maxLength={10} editable={!saving} onChangeText={changeDate} />
      <Text className="text-xs text-muted-foreground">Use today or one of the preceding 7 days.</Text>
      {logs.some(log => log.date === date) && <Text className="text-xs text-muted-foreground">A log is already saved for this date. Saving will update that entry.</Text>}
      <Field label="Work activity" multiline value={summary} editable={!saving} onChangeText={setSummary} maxLength={2000} placeholder="Describe the work you completed." />
      {saveError && <Text accessibilityRole="alert" className="text-xs text-danger">{saveError}</Text>}
      <Button label={saving ? "Saving…" : "Save Work Log"} disabled={saving} onPress={() => void save()} />
      <Button label="Cancel" variant="muted" disabled={saving} onPress={() => setEditing(false)} />
    </Sheet>}
    {viewing && <Sheet visible title="Work Log Details" subtitle={workerHistoryDate(viewing.date)} onClose={() => setViewing(null)}>
      <Text className="text-sm leading-6 text-foreground">{viewing.summary}</Text>
    </Sheet>}
  </>;
}
