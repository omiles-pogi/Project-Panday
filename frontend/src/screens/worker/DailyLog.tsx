import { useState } from "react";
import { Card, ChipPicker, Field, InfoBox, PageHeader, Screen, SubmitButton, SubmittedView } from "@/components/ui";

const PHASES = ["Foundation", "Structural Works", "Walls & Masonry"];

export default function DailyLog() {
  const [submitted, setSubmitted] = useState(false);
  const [phase, setPhase] = useState(PHASES[1]);
  const [form, setForm] = useState({
    date: "",
    area: "",
    timeIn: "",
    timeOut: "",
    breakMins: "",
    description: "",
    materials: "",
    tools: "",
    issues: "",
  });
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  if (submitted) {
    return (
      <SubmittedView
        title="Work Log Submitted"
        message="Your daily work log has been sent to your foreman for verification."
        again="Log Another Day"
        onAgain={() => setSubmitted(false)}
      >
        <InfoBox color="#f59e0b" title="🤖 AI ACKNOWLEDGMENT">
          Your log has been recorded. The AI will use it to update the project progress estimate.
        </InfoBox>
      </SubmittedView>
    );
  }

  return (
    <Screen>
      <PageHeader
        title="Daily Work Log"
        subtitle="Record today's completed work. Submitted logs are verified by your foreman."
      />
      <Card title="Work Details" gap={14}>
        <Field label="Date" placeholder="YYYY-MM-DD" value={form.date} onChangeText={set("date")} />
        <ChipPicker label="Construction Phase" options={PHASES} value={phase} onChange={setPhase} />
        <Field label="Work Area" placeholder="e.g. East wing, 2nd floor" value={form.area} onChangeText={set("area")} />
      </Card>
      <Card title="Time & Attendance" gap={14}>
        <Field label="Time In" placeholder="HH:MM" value={form.timeIn} onChangeText={set("timeIn")} />
        <Field label="Time Out" placeholder="HH:MM" value={form.timeOut} onChangeText={set("timeOut")} />
        <Field
          label="Break (minutes)"
          placeholder="e.g. 60"
          keyboardType="number-pad"
          value={form.breakMins}
          onChangeText={set("breakMins")}
        />
      </Card>
      <Card title="Work Accomplished" gap={14}>
        <Field
          label="Description of Work Done"
          placeholder="e.g. Laid 62 hollow blocks on the east wall, 2nd floor."
          multiline
          value={form.description}
          onChangeText={set("description")}
        />
        <Field label="Materials Used" placeholder="e.g. 62 CHB, 8 bags cement" value={form.materials} onChangeText={set("materials")} />
        <Field label="Tools / Equipment Used" placeholder="e.g. Masonry tools, level" value={form.tools} onChangeText={set("tools")} />
        <Field
          label="Issues / Observations (optional)"
          placeholder="Any safety concerns, material shortages, or blockers..."
          multiline
          value={form.issues}
          onChangeText={set("issues")}
        />
      </Card>
      <SubmitButton label="SUBMIT DAILY WORK LOG" onPress={() => setSubmitted(true)} />
    </Screen>
  );
}
