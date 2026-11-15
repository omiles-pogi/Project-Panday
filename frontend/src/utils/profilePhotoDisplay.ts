import { Platform } from "react-native";
import { readAccountPhoto } from "@/services/api/client";

/** Binary only; no base64 or public-storage URLs. Each avatar owns its temporary
 * copy and removes only that copy when replaced/unmounted, never Laravel's upload. */
export async function loadProfilePhoto(path: string, signal: AbortSignal): Promise<{ uri: string; dispose: () => void }> {
  const { bytes, type } = await readAccountPhoto(path, signal);
  if (signal.aborted) throw new Error("Photo loading was cancelled.");
  if (Platform.OS === "web") {
    const uri = URL.createObjectURL(new Blob([bytes], { type }));
    return { uri, dispose: () => URL.revokeObjectURL(uri) };
  }
  const { File, Paths } = await import("expo-file-system");
  if (signal.aborted) throw new Error("Photo loading was cancelled.");
  const extension = type === "image/jpeg" ? "jpg" : type === "image/png" ? "png" : "webp";
  const file = new File(Paths.cache, `panday-avatar-${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`);
  const dispose = () => { try { if (file.exists) file.delete(); } catch { /* Cache eviction can already have removed it. */ } };
  try {
    file.create();
    await file.write(bytes);
    if (signal.aborted) throw new Error("Photo loading was cancelled.");
    return { uri: file.uri, dispose };
  } catch {
    dispose();
    throw new Error("Your photo could not be opened on this device. Please retry.");
  }
}
