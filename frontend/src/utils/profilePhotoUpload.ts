import { Platform } from "react-native";
import type { ImagePickerAsset } from "expo-image-picker";
import { profilePhotoError } from "@/utils/profilePhoto";

/** SDK 58's multipart encoder accepts real Blob/File bytes, not RN's old URI descriptor. */
export async function profilePhotoFormData(asset: ImagePickerAsset): Promise<FormData> {
  const invalid = profilePhotoError(asset);
  if (invalid) throw new Error(invalid);
  const body = new FormData();
  if (Platform.OS === "web") {
    const file = asset.file;
    if (!file || file.size === 0) throw new Error("This photo is no longer readable. Please choose it again.");
    if (file.size > 5 * 1024 * 1024) throw new Error("Profile photos must be 5 MB or smaller.");
    body.append("photo", file, file.name);
  } else {
    let file;
    try {
      // Keep the native filesystem module out of account-screen initialization and web uploads.
      const { File } = await import("expo-file-system");
      file = new File(asset.uri);
      if (!file.exists || file.size === 0) throw new Error("unreadable");
    } catch {
      throw new Error("This photo could not be read. Please choose it again in a compatible Expo Go installation or development build.");
    }
    if (file.size > 5 * 1024 * 1024) throw new Error("Profile photos must be 5 MB or smaller.");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Choose a JPEG, PNG or WebP image with a supported file type.");
    // Use the selected local file's actual filename and MIME type (including picker edits),
    // and its inherited bytes() implementation. No base64 or URI-object type cast is needed.
    body.append("photo", file);
  }
  return body;
}
