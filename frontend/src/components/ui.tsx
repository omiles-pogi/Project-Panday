import { type ReactNode } from "react";
import { Pressable, ScrollView, Text, TextInput, View, type TextInputProps } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export type IconName = keyof typeof Ionicons.glyphMap;

export const MONO = "DMMono_500Medium";

export function Screen({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ padding: 16, paddingBottom: 96, gap: 16 }}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export function PageHeader({ title, subtitle, badge }: { title: string; subtitle?: string; badge?: string }) {
  return (
    <View>
      {badge ? (
        <View className="self-start px-2 py-0.5 rounded-full mb-1" style={{ backgroundColor: "#f59e0b20" }}>
          <Text className="text-xs font-semibold" style={{ color: "#f59e0b" }}>
            {badge}
          </Text>
        </View>
      ) : null}
      <Text className="text-2xl font-bold text-foreground">{title}</Text>
      {subtitle ? <Text className="text-sm mt-1 text-muted-foreground">{subtitle}</Text> : null}
    </View>
  );
}

export function Card({
  children,
  title,
  right,
  gap,
}: {
  children: ReactNode;
  title?: string;
  right?: ReactNode;
  gap?: number;
}) {
  return (
    <View className="rounded-3xl p-4 bg-card border border-border">
      {title ? (
        <View className="flex-row items-center justify-between mb-3">
          <Text className="font-bold text-sm text-foreground">{title}</Text>
          {right}
        </View>
      ) : null}
      {gap ? <View style={{ gap }}>{children}</View> : children}
    </View>
  );
}

export function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View className="self-start px-2 py-0.5 rounded-full" style={{ backgroundColor: `${color}20` }}>
      <Text className="text-xs font-semibold" style={{ color }}>
        {label}
      </Text>
    </View>
  );
}

export function ProgressBar({ pct, color, height = 8 }: { pct: number; color: string; height?: number }) {
  return (
    <View className="rounded-full overflow-hidden bg-muted" style={{ height }}>
      <View
        className="h-full rounded-full"
        style={{ width: `${Math.max(0, Math.min(100, pct))}%`, backgroundColor: color }}
      />
    </View>
  );
}

export function StatTile({
  label,
  value,
  color = "#f0f2f5",
  sub,
  icon,
}: {
  label: string;
  value: string | number;
  color?: string;
  sub?: string;
  icon?: IconName;
}) {
  return (
    <View className="p-4 rounded-2xl bg-card border border-border" style={{ width: "48%" }}>
      {icon ? <Ionicons name={icon} size={22} color={color} style={{ marginBottom: 4 }} /> : null}
      <Text className="text-xs mb-1 text-muted-foreground">{label}</Text>
      <Text className="text-xl font-bold" style={{ color, fontFamily: MONO }}>
        {value}
      </Text>
      {sub ? <Text className="text-xs mt-0.5 text-muted-foreground">{sub}</Text> : null}
    </View>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <View className="flex-row flex-wrap gap-3 justify-between">{children}</View>;
}

export function InfoBox({ color, title, children }: { color: string; title?: string; children: ReactNode }) {
  return (
    <View
      className="rounded-3xl p-4"
      style={{ backgroundColor: `${color}12`, borderWidth: 1, borderColor: `${color}30` }}
    >
      {title ? (
        <Text className="font-bold text-sm mb-1" style={{ color }}>
          {title}
        </Text>
      ) : null}
      {typeof children === "string" ? (
        <Text className="text-xs leading-5 text-secondary-foreground">{children}</Text>
      ) : (
        children
      )}
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = "primary",
  color,
}: {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "muted" | "tint";
  color?: string;
}) {
  const bg = variant === "primary" ? "#f59e0b" : variant === "tint" ? `${color}20` : "#252a3a";
  const fg = variant === "primary" ? "#0f1117" : variant === "tint" ? color : "#9ca3af";
  return (
    <Pressable onPress={onPress} className="px-4 py-2.5 rounded-xl items-center" style={{ backgroundColor: bg }}>
      <Text className="text-xs font-semibold" style={{ color: fg }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function SubmitButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="py-4 rounded-2xl items-center bg-primary">
      <Text className="font-bold text-sm text-primary-foreground">{label}</Text>
    </Pressable>
  );
}

export function Field({ label, multiline, ...props }: { label: string } & TextInputProps) {
  return (
    <View>
      <Text className="text-xs font-medium mb-2 text-secondary-foreground">{label}</Text>
      <TextInput
        {...props}
        multiline={multiline}
        placeholderTextColor="#4b5563"
        className="px-3 py-2.5 rounded-xl text-sm bg-muted border border-border text-foreground"
        style={multiline ? { minHeight: 90, textAlignVertical: "top" } : undefined}
      />
    </View>
  );
}

export function ChipPicker({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View>
      <Text className="text-xs font-medium mb-2 text-secondary-foreground">{label}</Text>
      <View className="flex-row flex-wrap gap-2">
        {options.map((o) => {
          const active = o === value;
          return (
            <Pressable
              key={o}
              onPress={() => onChange(o)}
              className="px-3 py-2 rounded-xl border"
              style={{ backgroundColor: active ? "#f59e0b20" : "#252a3a", borderColor: active ? "#f59e0b" : "#2a2f42" }}
            >
              <Text className="text-xs font-medium" style={{ color: active ? "#f59e0b" : "#9ca3af" }}>
                {o}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function MenuGrid({
  items,
  onSelect,
}: {
  items: readonly { href: string; label: string; icon: IconName }[];
  onSelect: (href: string) => void;
}) {
  return (
    <View className="flex-row flex-wrap gap-3">
      {items.map((item) => (
        <Pressable
          key={item.href}
          onPress={() => onSelect(item.href)}
          className="items-center gap-2 py-4 rounded-2xl bg-card border border-border"
          style={{ width: "30%" }}
        >
          <Ionicons name={item.icon} size={24} color="#f59e0b" />
          <Text className="text-xs font-semibold text-center text-muted-foreground">{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function SignOutButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="px-5 py-3 rounded-xl bg-card border border-border items-center">
      <Text className="text-danger text-sm font-semibold">Sign Out</Text>
    </Pressable>
  );
}

export function SubmittedView({
  title,
  message,
  again,
  onAgain,
  children,
}: {
  title: string;
  message: string;
  again: string;
  onAgain: () => void;
  children?: ReactNode;
}) {
  return (
    <Screen>
      <View className="items-center pt-6">
        <View
          className="w-16 h-16 rounded-full items-center justify-center mb-4"
          style={{ backgroundColor: "#10b98120" }}
        >
          <Ionicons name="checkmark" size={28} color="#10b981" />
        </View>
        <Text className="text-2xl font-bold text-center mb-2 text-foreground">{title}</Text>
        <Text className="text-sm text-center text-muted-foreground">{message}</Text>
      </View>
      {children}
      <SubmitButton label={again} onPress={onAgain} />
    </Screen>
  );
}
