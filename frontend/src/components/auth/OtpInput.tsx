import { useRef, useState, type ComponentRef } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { useTheme } from "@/context/ThemeContext";
import { editOtp } from "@/utils/otp";

export default function OtpInput({ digits, onChange, disabled = false }: { digits: string[]; onChange: (digits: string[]) => void; disabled?: boolean }) {
  const { chrome } = useTheme();
  const inputs = useRef<(ComponentRef<typeof TextInput> | null)[]>([]);
  const [focused, setFocused] = useState<number | null>(null);
  return (
    <View style={styles.row}>
      {digits.map((digit, index) => (
        <TextInput
          key={index}
          ref={(input) => { inputs.current[index] = input; }}
          accessibilityLabel={`Verification digit ${index + 1} of 6`}
          value={digit}
          editable={!disabled}
          keyboardType="number-pad"
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          textContentType={index === 0 ? "oneTimeCode" : "none"}
          selectTextOnFocus
          maxLength={6}
          onFocus={() => setFocused(index)}
          onBlur={() => setFocused(null)}
          onChangeText={(text) => {
            const next = editOtp(digits, index, text);
            onChange(next.digits);
            inputs.current[next.focus]?.focus();
          }}
          onKeyPress={({ nativeEvent }) => {
            if (nativeEvent.key === "Backspace" && !digit && index > 0) {
              const next = [...digits];
              next[index - 1] = "";
              onChange(next);
              inputs.current[index - 1]?.focus();
            }
          }}
          style={[styles.box, { backgroundColor: chrome.card, color: chrome.foreground, borderColor: focused === index ? "#f59e0b" : chrome.border, borderWidth: focused === index ? 2 : 1 }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8 },
  box: { flex: 1, minWidth: 0, height: 54, padding: 0, borderRadius: 12, textAlign: "center", fontSize: 22, fontWeight: "600" },
});
