import { useState } from "react";
import { Text, View } from "react-native";
import { Button, Field, InfoBox, SubmitButton } from "@/components/ui";
import { useConfirmDialog } from "@/components/ConfirmDialog";
import Sheet from "@/components/Sheet";
import { colors } from "@/theme/colors";
import { confirmProjectCompletion, requestProjectCorrections } from "@/services/api/projects";
import type { DashboardProject } from "@/types/project";
import { formatDateTime } from "@/utils/projectStatus";

/**
 * The homeowner's side of finishing a project. When the contractor submits it as finished, this is
 * where the homeowner confirms completion or sends it back with what needs fixing; afterwards it shows
 * the outcome. Nothing for an ordinary ongoing project.
 */
export default function ProjectCompletionCard({ project, onChanged }: { project: DashboardProject; onChanged: () => Promise<void> }) {
  const completion = project.completion;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [correcting, setCorrecting] = useState(false);
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const { ask, dialog } = useConfirmDialog();

  if (!completion) return null;

  const run = async (action: () => Promise<unknown>): Promise<boolean> => {
    if (busy) return false;
    setBusy(true);
    setError(null);
    try {
      await action();
      await onChanged();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't go through. Please try again.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const confirm = () =>
    ask({
      title: "Confirm project completion?",
      detail: project.title,
      message: "This confirms that the construction work is done and marks the project as Completed. You can then rate your team.",
      confirmLabel: "Confirm completion",
      icon: "checkmark-circle-outline",
      mood: "happy",
      onConfirm: () => void run(() => confirmProjectCompletion(project.id)),
    });

  const sendCorrections = async () => {
    if (note.trim().length < 3) {
      setNoteError("Tell the contractor what needs to be corrected.");
      return;
    }
    setNoteError(null);
    if (await run(() => requestProjectCorrections(project.id, note.trim()))) {
      setCorrecting(false);
      setNote("");
    }
  };

  if (project.status === "pending_confirmation") {
    return (
      <View style={{ gap: 10 }}>
        <InfoBox color="#8b5cf6" title="Project Status: Pending Homeowner Confirmation">
          {`${completion.submittedBy ?? "Your contractor"} marked this project as finished${
            completion.submittedAt ? ` on ${formatDateTime(completion.submittedAt)}` : ""
          }. Please review the work, then confirm completion or ask for corrections.`}
        </InfoBox>
        {error ? <Text className="text-xs text-danger px-1">{error}</Text> : null}
        <View className="flex-row flex-wrap gap-2">
          <View style={{ flexGrow: 1, flexBasis: "45%" }}>
            <Button label={busy ? "Please wait…" : "Confirm Project Completion"} disabled={busy} onPress={confirm} />
          </View>
          <View style={{ flexGrow: 1, flexBasis: "45%" }}>
            <Button label="Request Corrections" variant="tint" color="#ef4444" disabled={busy} onPress={() => setCorrecting(true)} />
          </View>
        </View>

        {correcting ? (
          <Sheet
            visible
            title="Request corrections"
            subtitle="Tell your contractor what needs to be fixed. The project goes back to Ongoing and they can update the checklist."
            onClose={() => setCorrecting(false)}
          >
            <View style={{ gap: 14 }}>
              <Field
                label="What needs to be corrected?"
                multiline
                value={note}
                onChangeText={setNote}
                maxLength={1000}
                placeholder="e.g. The east wall needs repainting and the bathroom tiles are uneven."
              />
              {noteError ? <Text className="text-xs text-danger">{noteError}</Text> : null}
              {error ? <Text className="text-xs text-danger">{error}</Text> : null}
              <SubmitButton label={busy ? "Sending…" : "Send to contractor"} onPress={() => void sendCorrections()} />
            </View>
          </Sheet>
        ) : null}

        {dialog}
      </View>
    );
  }

  if (project.status === "completed") {
    // On a small project with no contractor, the homeowner finishes and confirms in one step —
    // both timestamps land together, and there's no contractor to credit for the work.
    const selfCompleted = !!completion.submittedAt && completion.submittedAt === completion.confirmedAt;
    return (
      <InfoBox color="#10b981" title="Project Status: Completed">
        {selfCompleted
          ? `You marked this project as finished on ${formatDateTime(completion.submittedAt!)} — with no contractor assigned, there was nothing left to confirm.`
          : [
              completion.confirmedAt ? `You confirmed completion on ${formatDateTime(completion.confirmedAt)}.` : null,
              completion.submittedAt ? `Your contractor finished the work on ${formatDateTime(completion.submittedAt)}.` : null,
            ]
              .filter(Boolean)
              .join(" ")}
      </InfoBox>
    );
  }

  if (project.status === "active" && completion.correctionsNote) {
    return (
      <InfoBox color={colors.warning} title="Corrections requested">
        {`You asked your contractor to fix: ${completion.correctionsNote}${
          completion.correctionsRequestedAt ? `\nSent ${formatDateTime(completion.correctionsRequestedAt)}.` : ""
        }\nThe project is back to Ongoing. You'll be asked to confirm again once they resubmit it.`}
      </InfoBox>
    );
  }

  return null;
}
