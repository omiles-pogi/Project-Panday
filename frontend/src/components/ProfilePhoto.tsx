import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { ActivityIndicator, Alert, Image, Modal, Platform, Pressable, Text, View } from "react-native";
import { requireOptionalNativeModule } from "expo";
import type { ImagePickerAsset } from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { useAccount } from "@/context/AccountContext";
import { useTheme } from "@/context/ThemeContext";
import { loadProfilePhoto } from "@/utils/profilePhotoDisplay";
import { removeProfilePhoto, uploadProfilePhoto } from "@/services/api/account";
import { profilePhotoError } from "@/utils/profilePhoto";

export function ProfileAvatar({ name, url, size = 64, reloadKey = 0, onPhotoError }: { name: string; url?: string | null; size?: number; reloadKey?: number; onPhotoError?: (message: string | null) => void }) {
  return <AvatarContent key={`${url ?? "default"}:${name}:${reloadKey}`} name={name} url={url} size={size} onPhotoError={onPhotoError} />;
}
function AvatarContent({ name, url, size, onPhotoError }: { name: string; url?: string | null; size: number; onPhotoError?: (message: string | null) => void }) {
  const [failed, setFailed] = useState(false);
  const [uri, setUri] = useState<string | null>(null);
  const report = useRef(onPhotoError);
  useEffect(() => { report.current = onPhotoError; }, [onPhotoError]);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let dispose: (() => void) | undefined;
    const timeout = setTimeout(() => controller.abort(), 20_000);
    // ProfileAvatar keys this component by photo version/retry, so new photos start
    // fresh without preserving a failed native image or resetting state in an effect.
    if (url) void loadProfilePhoto(url, controller.signal).then(photo => {
      if (controller.signal.aborted) { photo.dispose(); return; }
      dispose = photo.dispose; setUri(photo.uri);
    }).catch(error => {
      if (!active) return;
      setFailed(true);
      report.current?.(controller.signal.aborted ? "Photo loading timed out. Check your connection and retry." : error instanceof Error ? error.message : "Could not load your photo. Please retry.");
    }).finally(() => clearTimeout(timeout));
    else clearTimeout(timeout);
    return () => { active = false; controller.abort(); clearTimeout(timeout); dispose?.(); };
  }, [url]);
  const initials = name.trim().split(/\s+/).map(part => part[0]).slice(0, 2).join("").toUpperCase() || "?";
  return <View style={{ width: size, height: size, borderRadius: size / 2, overflow: "hidden", backgroundColor: "#f59e0b20", alignItems: "center", justifyContent: "center" }}>
    {url && !failed ? uri ? <Image accessibilityLabel={`${name}'s profile photo`} source={{ uri }} onLoad={() => report.current?.(null)} onError={() => { setFailed(true); report.current?.("Your saved photo could not be displayed. Retry or choose another image."); }} style={{ width: size, height: size }} /> : <ActivityIndicator accessibilityLabel="Loading profile photo" color="#f59e0b" /> :
      <Text style={{ color: "#f59e0b", fontSize: size * 0.32, fontWeight: "800" }}>{initials}</Text>}
  </View>;
}

export default function ProfilePhoto({ name }: { name: string }) {
  const { user } = useAuth();
  const account = useAccount();
  const refreshAccount = account.refresh;
  useFocusEffect(useCallback(() => { void refreshAccount(); }, [refreshAccount]));
  const { chrome } = useTheme();
  const [selected, setSelected] = useState<ImagePickerAsset | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  useFocusEffect(useCallback(() => { setReloadKey(key => key + 1); }, []));
  const working = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const url = account.data ? account.data.photoUrl : user?.profile_photo_url;

  const choose = async (camera: boolean) => {
    if (working.current) return;
    working.current = true; setBusy(true); setError(null); setActionsOpen(false);
    try {
      // Native image picking loads only after an explicit camera/gallery action. Expo Go
      // includes ImagePicker; an older custom binary must be rebuilt after adding it.
      if (Platform.OS !== "web" && !requireOptionalNativeModule("ExponentImagePicker")) throw new Error("Photo selection needs an updated development build or compatible Expo Go.");
      const picker = await import("expo-image-picker");
      if (camera || Platform.OS === "ios") {
        const permission = camera ? await picker.requestCameraPermissionsAsync() : await picker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) throw new Error(`${camera ? "Camera" : "Photo library"} permission was denied. You can allow access in your device settings.`);
      }
      if (!alive.current) return;
      const options = { mediaTypes: ["images"] as ("images")[], allowsEditing: true, aspect: [1, 1] as [number, number], quality: 0.9, exif: false };
      // Android uses the system photo picker without requesting access to the entire library.
      const result = camera ? await picker.launchCameraAsync(options) : await picker.launchImageLibraryAsync(options);
      if (!alive.current || result.canceled) return;
      const asset = result.assets[0];
      const invalid = profilePhotoError(asset);
      if (invalid) throw new Error(invalid);
      setSelected(asset);
    } catch (err) { if (alive.current) setError(err instanceof Error ? err.message : "Could not open your photos."); }
    finally { working.current = false; if (alive.current) setBusy(false); }
  };
  const save = async (remove = false) => {
    if (working.current || (!remove && !selected)) return;
    working.current = true; setBusy(true); setError(null);
    try {
      let response;
      if (remove) response = await removeProfilePhoto();
      else response = await uploadProfilePhoto(selected!);
      if (response.userId !== user?.id) throw new Error("The response did not match your account. Reopen your profile and try again.");
      if (alive.current) { await account.acceptPhoto(response); setPhotoError(null); setReloadKey(key => key + 1); setSelected(null); }
    } catch (err) { if (alive.current) setError(err instanceof Error ? err.message : "Could not save your profile photo."); }
    finally { working.current = false; if (alive.current) setBusy(false); }
  };
  return <View style={{ gap: 8, maxWidth: 240 }}>
    <View style={{ width: 72, height: 72 }}>
      <ProfileAvatar name={name} url={url} size={64} reloadKey={reloadKey} onPhotoError={setPhotoError} />
      <Pressable accessibilityRole="button" accessibilityLabel="Change profile photo" hitSlop={8} disabled={busy || !account.ready} onPress={() => setActionsOpen(true)}
        style={{ position: "absolute", right: 0, bottom: 0, width: 30, height: 30, borderRadius: 15, backgroundColor: "#f59e0b", alignItems: "center", justifyContent: "center", opacity: account.ready ? 1 : 0.5 }}>
        {busy ? <ActivityIndicator size="small" color="#111" /> : <Ionicons name="camera" size={17} color="#111" />}
      </Pressable>
    </View>
    {error && !selected && <Text accessibilityRole="alert" style={{ color: "#ef4444", fontSize: 12 }}>{error}</Text>}
    {photoError && <View style={{ gap: 4 }}><Text accessibilityRole="alert" style={{ color: "#ef4444", fontSize: 12 }}>{photoError}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Retry profile photo" disabled={busy} onPress={() => { setPhotoError(null); setReloadKey(key => key + 1); void refreshAccount(); }} style={{ minHeight: 36, justifyContent: "center" }}><Text style={{ color: chrome.foreground, fontSize: 12 }}>Retry photo</Text></Pressable></View>}
    {/* Android Alert supports at most three buttons; a sheet keeps all photo actions reachable. */}
    <Modal visible={actionsOpen} transparent animationType="fade" onRequestClose={() => setActionsOpen(false)}>
      <View style={{ flex: 1, justifyContent: "center", backgroundColor: "#0009", padding: 24 }}><View style={{ width: "100%", maxWidth: 380, alignSelf: "center", backgroundColor: chrome.card, borderRadius: 24, padding: 20, gap: 12 }}>
        <Text style={{ color: chrome.foreground, fontSize: 18, fontWeight: "700" }}>{url ? "Change Profile Photo" : "Add Profile Photo"}</Text>
        <Text style={{ color: chrome.secondaryForeground, fontSize: 12 }}>JPEG, PNG or WebP · Up to 5 MB. Review your photo before saving.</Text>
        <Pressable accessibilityRole="button" onPress={() => void choose(false)} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ color: chrome.foreground }}>Choose from gallery</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => void choose(true)} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ color: chrome.foreground }}>Take photo</Text></Pressable>
        {url && <Pressable accessibilityRole="button" onPress={() => { setActionsOpen(false); Alert.alert("Remove profile photo?", "Your default avatar will be restored.", [{ text: "Cancel", style: "cancel" }, { text: "Remove", style: "destructive", onPress: () => void save(true) }]); }} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ color: chrome.foreground }}>Remove photo</Text></Pressable>}
        <Pressable accessibilityRole="button" onPress={() => setActionsOpen(false)} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ color: chrome.foreground }}>Cancel</Text></Pressable>
      </View></View>
    </Modal>
    <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => { if (!busy) { setSelected(null); setError(null); } }}>
      <View style={{ flex: 1, justifyContent: "center", backgroundColor: "#0009", padding: 24 }}>
        <View style={{ width: "100%", maxWidth: 380, alignSelf: "center", backgroundColor: chrome.card, borderRadius: 24, padding: 20, gap: 16 }}>
          <Text style={{ color: chrome.foreground, fontSize: 18, fontWeight: "700" }}>Preview profile photo</Text>
          {selected && <Image source={{ uri: selected.uri }} style={{ width: "100%", aspectRatio: 1, borderRadius: 20 }} />}
          {error && <Text accessibilityRole="alert" style={{ color: "#ef4444" }}>{error}</Text>}
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Pressable accessibilityRole="button" disabled={busy} onPress={() => { setSelected(null); setError(null); }} style={{ flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: chrome.muted }}><Text style={{ color: chrome.foreground }}>Cancel</Text></Pressable>
            <Pressable accessibilityRole="button" disabled={busy} onPress={() => void save()} style={{ flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "#f59e0b" }}><Text style={{ color: "#111", fontWeight: "700" }}>{busy ? "Saving…" : "Save Photo"}</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal>
  </View>;
}
