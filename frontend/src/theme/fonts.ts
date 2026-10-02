import {
  useFonts,
  Inter_300Light,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from "@expo-google-fonts/inter";
import { DMMono_400Regular, DMMono_500Medium } from "@expo-google-fonts/dm-mono";

// Matches resources/css/app.css's Google Fonts import (Inter 300-800, DM Mono 400/500).
export function useAppFonts() {
  return useFonts({
    Inter_300Light,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    DMMono_400Regular,
    DMMono_500Medium,
  });
}

export const fonts = {
  light: "Inter_300Light",
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  extrabold: "Inter_800ExtraBold",
  mono: "DMMono_400Regular",
  monoMedium: "DMMono_500Medium",
} as const;
