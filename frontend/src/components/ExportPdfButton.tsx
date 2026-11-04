import { useState } from "react";
import { Text, View } from "react-native";
import { Button } from "@/components/ui";

/** Builds a PDF and opens the share sheet; shows what went wrong under the button if it can't. */
export default function ExportPdfButton({ onExport, label = "Export PDF" }: { onExport: () => Promise<void>; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onExport();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the PDF. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 6 }}>
      <Button label={busy ? "Preparing PDF…" : label} variant="muted" onPress={run} />
      {error ? <Text className="text-xs text-danger">{error}</Text> : null}
    </View>
  );
}
