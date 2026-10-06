import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

// expo-secure-store has no web implementation, so the browser build (used for
// testing) falls back to localStorage. Native builds keep using SecureStore.
const isWeb = Platform.OS === "web";

export const tokenStorage = {
  getItem: async (key: string): Promise<string | null> =>
    isWeb ? window.localStorage.getItem(key) : SecureStore.getItemAsync(key),
  setItem: async (key: string, value: string): Promise<void> => {
    if (isWeb) window.localStorage.setItem(key, value);
    else await SecureStore.setItemAsync(key, value);
  },
  deleteItem: async (key: string): Promise<void> => {
    if (isWeb) window.localStorage.removeItem(key);
    else await SecureStore.deleteItemAsync(key);
  },
};
