import { useState } from "react";
import { Text, View } from "react-native";
import { Card, ChipPicker, Field, InfoBox, MONO, PageHeader, Screen, SubmitButton, SubmittedView } from "@/components/ui";
import { PHASES, PROJECTS } from "@/data/contractor";

const PROJECT_NAMES = PROJECTS.slice(0, 3).map((p) => p.name);

export default function ProgressReport() {
  const [submitted, setSubmitted] = useState(false);
  const [project, setProject] = useState(PROJECT_NAMES[0]);
  const [phase, setPhase] = useState(PHASES[1]);
  const [form, setForm] = useState({
    area: "",
    date: "",
    description: "",
    startDate: "",
    endDate: "",
    workers: "",
    materials: "",
    equipment: "",
    expenses: "",
    notes: "",
  });
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  if (submitted) {
    return (
      <SubmittedView
        title="Progress Report Submitted"
        message="The AI is now analyzing your progress report and will generate an updated progress analysis."
        again="Submit Another Report"
        onAgain={() => setSubmitted(false)}
      >
        <Card title="AI Analysis Preview">
          <View className="flex-row flex-wrap gap-2 mb-3">
            {[
              { label: "Previous Progress", value: "34%", color: "#9ca3af" },
              { label: "New Work Completed", value: "8%", color: "#3b82f6" },
              { label: "Current Progress", value: "42%", color: "#f59e0b" },
              { label: "Expected Progress", value: "48%", color: "#10b981" },
            ].map(({ label, value, color }) => (
              <View key={label} className="p-3 rounded-xl bg-muted" style={{ width: "48%" }}>
                <Text className="text-xs mb-1 text-muted-foreground">{label}</Text>
                <Text className="font-bold" style={{ color, fontFamily: MONO }}>
                  {value}
                </Text>
              </View>
            ))}
          </View>
          <InfoBox color="#f59e0b">
            <Text className="text-sm font-semibold" style={{ color: "#f59e0b" }}>
              Status: SLIGHTLY BEHIND SCHEDULE
            </Text>
          </InfoBox>
        </Card>
      </SubmittedView>
    );
  }

  return (
    <Screen>
      <PageHeader
        title="Progress Report"
        subtitle="Submit a progress update for AI analysis and homeowner visibility."
      />
      <Card title="Project & Phase">
        <View style={{ gap: 14 }}>
          <ChipPicker label="Project" options={PROJECT_NAMES} value={project} onChange={setProject} />
          <ChipPicker label="Construction Phase" options={PHASES} value={phase} onChange={setPhase} />
          <Field label="Work Area" placeholder="e.g. East wing, 2nd floor columns" value={form.area} onChangeText={set("area")} />
          <Field label="Report Date" placeholder="YYYY-MM-DD" value={form.date} onChangeText={set("date")} />
        </View>
      </Card>
      <Card title="Work Completed">
        <View style={{ gap: 14 }}>
          <Field
            label="Description of Completed Work"
            placeholder="Describe all work completed during this period..."
            multiline
            value={form.description}
            onChangeText={set("description")}
          />
          <Field label="Start Date" placeholder="YYYY-MM-DD" value={form.startDate} onChangeText={set("startDate")} />
          <Field label="Completion Date" placeholder="YYYY-MM-DD" value={form.endDate} onChangeText={set("endDate")} />
        </View>
      </Card>
      <Card title="Resources Used">
        <View style={{ gap: 14 }}>
          <Field label="Workers Used (count)" keyboardType="number-pad" value={form.workers} onChangeText={set("workers")} />
          <Field label="Materials Used" value={form.materials} onChangeText={set("materials")} />
          <Field label="Equipment Used" value={form.equipment} onChangeText={set("equipment")} />
        </View>
      </Card>
      <Card title="Expenses & Notes">
        <View style={{ gap: 14 }}>
          <Field
            label="Total Expenses (₱)"
            placeholder="e.g. 85000"
            keyboardType="number-pad"
            value={form.expenses}
            onChangeText={set("expenses")}
          />
          <Field
            label="Additional Notes"
            placeholder="Any issues, challenges, or observations..."
            multiline
            value={form.notes}
            onChangeText={set("notes")}
          />
        </View>
      </Card>
      <SubmitButton label="SUBMIT PROGRESS REPORT" onPress={() => setSubmitted(true)} />
    </Screen>
  );
}
