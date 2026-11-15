import { useCallback, useEffect, useRef, useState } from "react";

/** Saved values and drafts are separate: only a confirmed server save replaces the baseline. */
export function useProfileEdit<T>(initial: T) {
  const [baseline, setBaseline] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [ready, setReady] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const load = useCallback((value: T) => {
    setBaseline(value);
    setDraft(value);
    setReady(true);
    setEditing(false);
  }, []);

  const begin = () => {
    if (!ready || inFlight.current) return;
    setDraft(baseline);
    setError(null);
    setSaved(false);
    setEditing(true);
  };
  const cancel = () => {
    if (inFlight.current) return;
    setDraft(baseline);
    setError(null);
    setEditing(false);
  };
  const change = <K extends keyof T>(key: K, value: T[K]) => {
    if (!editing || inFlight.current) return;
    setDraft((current) => ({ ...current, [key]: value }));
  };
  const save = async (persist: (value: T) => Promise<T>) => {
    if (!ready || !editing || inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setError(null);
    try {
      const confirmed = await persist(draft);
      if (mounted.current) {
        setBaseline(confirmed);
        setDraft(confirmed);
        setEditing(false);
        setSaved(true);
      }
    } catch (err) {
      if (mounted.current) setError(err instanceof Error ? err.message : "Failed to save profile.");
    } finally {
      inFlight.current = false;
      if (mounted.current) setSaving(false);
    }
  };
  return { baseline, draft, ready, editing, saving, saved, error, load, begin, cancel, change, save };
}
