import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Mascot from "@/components/Mascot";
import { useAuth } from "@/context/AuthContext";
import { approvalStatusRequest } from "@/services/api/auth";

const POLL_MS = 5000;

type Decision = "waiting" | "approved" | "rejected";

// Shown after sign-up (or a sign-in attempt) while an admin reviews the account.
// Polls for the decision and signs the user in automatically once approved.
export default function WaitingApproval() {
  const { pending, clearPending } = useAuth();
  const [decision, setDecision] = useState<Decision>("waiting");
  const [dots, setDots] = useState(1);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  useEffect(() => {
    const id = setInterval(() => setDots((d) => (d % 3) + 1), 500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!pending || decision !== "waiting") return;
    let cancelled = false;

    const check = async () => {
      try {
        const { approval_status } = await approvalStatusRequest({ email: pending.email, password: pending.password });
        if (cancelled) return;
        setLastChecked(new Date());
        if (approval_status === "approved") setDecision("approved");
        else if (approval_status === "rejected") setDecision("rejected");
      } catch {
        // network blip: keep waiting, the next poll will retry
      }
    };

    check();
    const id = setInterval(check, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [pending, decision]);

  if (!pending) return null;

  const firstName = pending.name.trim().split(" ")[0];
  const waiting = decision === "waiting";

  const title =
    decision === "approved"
      ? "You're approved!"
      : decision === "rejected"
        ? "Account not approved"
        : `Waiting for approval${".".repeat(dots)}`;

  const subtitle =
    decision === "approved"
      ? "Your account is ready. Go back to the sign-in page and log in to start building."
      : decision === "rejected"
        ? "Sorry, an admin couldn't approve this account. Please contact support if you think this is a mistake."
        : `${firstName ? `Hang tight, ${firstName}! ` : "Hang tight! "}An admin is reviewing your details. This page updates by itself — you can keep it open.`;

  return (
    <ScrollView className="flex-1 bg-background" contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}>
      <View className="px-6 py-10 items-center">
        <Mascot
          size={150}
          bob={waiting}
          mood={decision === "approved" ? "happy" : decision === "rejected" ? "sad" : "thinking"}
        />

        <Text className="text-2xl font-extrabold text-foreground text-center mt-4">{title}</Text>
        <Text className="text-sm text-muted-foreground text-center mt-2 leading-relaxed" style={{ maxWidth: 360 }}>
          {subtitle}
        </Text>

        <View className="w-full mt-8 gap-3" style={{ maxWidth: 360 }}>
          <Step done label="Account created" />
          <Step
            done={decision !== "waiting"}
            active={waiting}
            failed={decision === "rejected"}
            label="Admin review"
          />
          <Step done={decision === "approved"} active={decision === "approved"} label="Start building" />
        </View>

        {waiting && lastChecked ? (
          <Text className="text-xs text-muted-foreground mt-6">
            Last checked {lastChecked.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </Text>
        ) : null}

        {decision === "approved" ? (
          <Pressable
            onPress={() => clearPending(pending.email)}
            className="mt-6 px-8 py-3.5 rounded-xl bg-primary"
          >
            <Text className="text-sm font-bold text-primary-foreground">Go to sign in</Text>
          </Pressable>
        ) : (
          <Pressable onPress={() => clearPending()} className="mt-6 px-5 py-2.5 rounded-xl bg-card border border-border">
            <Text className="text-sm font-semibold text-muted-foreground">Back to sign in</Text>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

function Step({ label, done, active, failed }: { label: string; done?: boolean; active?: boolean; failed?: boolean }) {
  const color = failed ? "#ef4444" : done ? "#10b981" : active ? "#f59e0b" : "#6b7280";
  const icon = failed ? "close-circle" : done ? "checkmark-circle" : active ? "time" : "ellipse-outline";
  return (
    <View className="flex-row items-center gap-3 px-4 py-3 rounded-xl bg-card border border-border">
      <Ionicons name={icon} size={20} color={color} />
      <Text className="text-sm font-medium" style={{ color: done || active || failed ? "#f0f2f5" : "#6b7280" }}>
        {label}
      </Text>
    </View>
  );
}
