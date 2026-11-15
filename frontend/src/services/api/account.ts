import { apiFetch, apiUploadPhoto } from "./client";
import type { ImagePickerAsset } from "expo-image-picker";
import { profilePhotoFormData } from "@/utils/profilePhotoUpload";

export interface NotificationPreferences { push_enabled: boolean; project_updates: boolean; messages: boolean }
export interface AccountSettings { userId: number; photoUrl: string | null; preferences: NotificationPreferences }

export const fetchAccountSettings = () => apiFetch("/api/account") as Promise<AccountSettings>;
export const updateNotificationPreferences = (changes: Partial<NotificationPreferences>) => apiFetch("/api/account/preferences", { method: "PATCH", body: JSON.stringify(changes) }) as Promise<AccountSettings>;
export const uploadProfilePhoto = (asset: ImagePickerAsset) => apiUploadPhoto(() => profilePhotoFormData(asset)) as Promise<AccountSettings>;
export const removeProfilePhoto = () => apiFetch("/api/account/photo", { method: "DELETE" }) as Promise<AccountSettings>;
export const changeAccountPassword = (fields: { current_password: string; password: string; password_confirmation: string }) => apiFetch("/api/account/password", { method: "POST", body: JSON.stringify(fields) }) as Promise<{ message: string }>;
