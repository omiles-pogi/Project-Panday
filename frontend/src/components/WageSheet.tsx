import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import Sheet from "@/components/Sheet";
import { Button, Field, SubmitButton } from "@/components/ui";
import { useTheme } from "@/context/ThemeContext";
import type { Wage, WageInput } from "@/types/project";
import { peso } from "@/utils/currency";
import { wageLine } from "@/utils/wage";

type Unit = Wage["unit"];

const UNITS: { key: Unit; label: string; hint: string }[] = [
  { key: "per_day", label: "Per day", hint: "A day rate for a number of working days" },
  { key: "fixed", label: "Fixed fee", hint: "One agreed amount for the whole job" },
];

// Typed as text and parsed on save, so a half-typed "85" never fights the cursor.
const toNumber = (s: string) => {
  const n = parseFloat(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};

/**
 * Sets what one worker or contractor is paid on a project — a day rate × days, or a fixed fee.
 * Mount it only while editing: the form is seeded once from `current` on mount, so cancelling leaves
 * nothing behind. `onSave` rejects with the backend's message, which is shown instead of closing.
 */
export default function WageSheet({
  name,
  current,
  defaultUnit,
  minDailyWage,
  onClose,
  onSave,
}: {
  name: string;
  current: Wage | null | undefined;
  /** Contractors are usually agreed on a fee, workers on a day rate. */
  defaultUnit: Unit;
  /** What a worker asks per day, if they've said — shown as a guide and used to pre-fill a new day rate. */
  minDailyWage?: number | null;
  onClose: () => void;
  onSave: (input: WageInput) => Promise<void>;
}) {
  const { chrome } = useTheme();
  const [unit, setUnit] = useState<Unit>(current?.unit ?? defaultUnit);
  const [amount, setAmount] = useState(current ? String(current.amount) : minDailyWage && defaultUnit === "per_day" ? String(minDailyWage) : "");
  const [days, setDays] = useState(current?.days ? String(current.days) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [custom, setCustom] = useState(false);

  const belowAsk = !!minDailyWage && unit === "per_day" && toNumber(amount) > 0 && toNumber(amount) < minDailyWage;
  const total = unit === "fixed" ? toNumber(amount) : toNumber(amount) * Math.round(toNumber(days));

  const submit = async (input: WageInput) => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(input);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the wage.");
      setSaving(false);
    }
  };

  const save = () => {
    const value = Math.round(toNumber(amount));
    if (value <= 0) {
      setError("Enter the wage amount.");
      return;
    }
    if (unit === "per_day" && Math.round(toNumber(days)) < 1) {
      setError("Enter how many days the day rate covers.");
      return;
    }
    submit({ amount: value, unit, days: unit === "per_day" ? Math.round(toNumber(days)) : null });
  };

  return (
    <Sheet visible title={`Wage for ${name}`} subtitle="No manual entry required." onClose={onClose}>
      <Text className="text-xs leading-5 text-muted-foreground">
        {defaultUnit === "per_day"
          ? "The app uses the worker's asking daily rate, or its default rate, and calculates the total from your project's working days."
          : "The app uses this contractor's accepted project quote, or calculates a fee from your project's estimate and contractor count."}
        {" "}Calculated amounts are estimates. The team member is notified when you save.
      </Text>
      {current && <Text className="text-sm font-semibold text-foreground">Current: {wageLine(current)}</Text>}
      {error && <Text className="text-xs text-danger">{error}</Text>}
      <SubmitButton label={saving ? "Saving…" : "Use automatic wage"} onPress={() => submit({ automatic: true })} />
      <Button variant="muted" label={custom ? "Hide custom amount" : "Enter a custom amount (optional)"} onPress={() => setCustom((value) => !value)} />

      {custom && <View style={{ gap: 12 }}>

      <View className="flex-row gap-2">
        {UNITS.map(({ key, label }) => {
          const active = key === unit;
          return (
            <Pressable
              key={key}
              onPress={() => setUnit(key)}
              className="flex-1 py-2.5 rounded-xl items-center border"
              style={{ backgroundColor: active ? "#f59e0b20" : chrome.muted, borderColor: active ? "#f59e0b" : chrome.border }}
            >
              <Text className="text-xs font-semibold" style={{ color: active ? "#f59e0b" : chrome.mutedForeground }}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text className="text-xs text-muted-foreground">{UNITS.find((u) => u.key === unit)?.hint}</Text>

      {!!minDailyWage && (
        <Text className="text-xs" style={{ color: belowAsk ? "#f59e0b" : "#10b981" }}>
          {name} asks for at least {peso(minDailyWage)}/day.{belowAsk ? " This rate is below that." : ""}
        </Text>
      )}

      <Field
        label={unit === "fixed" ? "Fee (₱)" : "Rate per day (₱)"}
        keyboardType="numeric"
        value={amount}
        onChangeText={setAmount}
        placeholder={unit === "fixed" ? "e.g. 350000" : "e.g. 850"}
      />
      {unit === "per_day" && (
        <Field label="Number of days" keyboardType="number-pad" value={days} onChangeText={setDays} placeholder="e.g. 30" />
      )}

      <View className="flex-row items-center justify-between rounded-xl px-4 py-3 bg-muted">
        <Text className="text-sm font-bold text-foreground">Total</Text>
        <Text className="text-sm font-bold" style={{ color: "#f59e0b" }}>
          {peso(total)}
        </Text>
      </View>

      <SubmitButton label={saving ? "Saving…" : "Save custom wage"} onPress={save} />
      {current && <Button variant="muted" label="Clear wage" onPress={() => submit({ amount: null, unit })} />}
      </View>}
    </Sheet>
  );
}
