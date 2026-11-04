import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { CountUp } from "@/components/charts";
import Sheet from "@/components/Sheet";
import { Field, MONO, SubmitButton } from "@/components/ui";
import { useTheme } from "@/context/ThemeContext";
import { peso } from "@/utils/currency";

// Typed as text and parsed on save, so a half-typed "25" never fights the cursor.
const toNumber = (s: string) => {
  const n = parseFloat(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};

/** Rounds up to the next ₱1,000 so a suggested top-up is a number a person would actually type. */
const roundUp = (n: number) => Math.ceil(n / 1000) * 1000;

/**
 * Adds to the homeowner's budget once the AI estimate has gone past it. Shows the shortfall, two ready-made
 * amounts (cover it exactly, or with a 10% cushion) and what the budget and the left over would become.
 * Mount it only while open. `onSave` rejects with the backend's message, which is shown instead of closing.
 */
export default function AddBudgetSheet({
  budget,
  estimate,
  onClose,
  onSave,
}: {
  budget: number;
  estimate: number;
  onClose: () => void;
  onSave: (amount: number) => Promise<void>;
}) {
  const { chrome } = useTheme();
  const shortfall = Math.max(0, estimate - budget);
  const cover = roundUp(shortfall);
  const withCushion = roundUp(shortfall * 1.1);

  const [amount, setAmount] = useState(cover > 0 ? String(cover) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = Math.round(toNumber(amount));
  const newBudget = budget + Math.max(0, add);
  const leftOver = newBudget - estimate;

  const save = async () => {
    if (saving) return;
    if (add < 1) {
      setError("Enter how much to add to your budget.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(add);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add to your budget.");
      setSaving(false);
    }
  };

  const options = [
    { label: "Cover the shortfall", value: cover },
    { label: "With a 10% cushion", value: withCushion },
  ].filter((o, i, all) => o.value > 0 && all.findIndex((x) => x.value === o.value) === i);

  return (
    <Sheet visible title="Add Budget" subtitle="Raise your budget to cover what this project now costs." onClose={onClose}>
      <View className="rounded-xl px-4 py-3" style={{ backgroundColor: shortfall > 0 ? "#ef444415" : chrome.muted, gap: 4 }}>
        <Row label="Your budget" value={peso(budget)} />
        <Row label="AI estimate now" value={peso(estimate)} />
        {shortfall > 0 && <Row label="Short by" value={peso(shortfall)} color="#ef4444" bold />}
      </View>

      {options.length > 0 && (
        <View className="flex-row flex-wrap gap-2">
          {options.map((o) => {
            const active = add === o.value;
            return (
              <Pressable
                key={o.label}
                onPress={() => setAmount(String(o.value))}
                className="px-3 py-2 rounded-xl border"
                style={{ backgroundColor: active ? "#f59e0b20" : chrome.muted, borderColor: active ? "#f59e0b" : chrome.border }}
              >
                <Text className="text-xs font-semibold" style={{ color: active ? "#f59e0b" : chrome.mutedForeground }}>
                  {o.label} · {peso(o.value)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <Field label="Amount to add (₱)" keyboardType="numeric" value={amount} onChangeText={setAmount} placeholder="e.g. 250000" />

      <View className="rounded-xl px-4 py-3 bg-muted" style={{ gap: 4 }}>
        <Row label="New budget" value={peso(newBudget)} bold />
        <Row
          label={leftOver >= 0 ? "Left over after" : "Still short by"}
          value={peso(Math.abs(leftOver))}
          color={leftOver >= 0 ? "#10b981" : "#ef4444"}
          bold
        />
      </View>

      {error && <Text className="text-xs text-danger">{error}</Text>}
      <SubmitButton label={saving ? "Adding…" : add > 0 ? `Add ${peso(add)} to budget` : "Add to budget"} onPress={save} />
    </Sheet>
  );
}

function Row({ label, value, color, bold }: { label: string; value: string; color?: string; bold?: boolean }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className={`text-sm ${bold ? "font-bold" : ""} text-foreground`}>{label}</Text>
      {/* Quick and glides from the last figure, so retyping the amount visibly moves the new budget and left over. */}
      <CountUp text={value} duration={400} className={`text-sm ${bold ? "font-bold" : ""} text-foreground`} style={{ fontFamily: MONO, ...(color ? { color } : {}) }} />
    </View>
  );
}
