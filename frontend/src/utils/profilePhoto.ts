import type { ImagePickerAsset } from "expo-image-picker";

export function profilePhotoError(asset: ImagePickerAsset): string | null {
  if (!asset.mimeType || !["image/jpeg", "image/png", "image/webp"].includes(asset.mimeType)) return "Choose a JPEG, PNG or WebP image.";
  if (asset.fileSize != null && asset.fileSize > 5 * 1024 * 1024) return "Profile photos must be 5 MB or smaller.";
  if (asset.width > 4096 || asset.height > 4096) return "Crop or resize your photo to 4096 × 4096 pixels or smaller.";
  return null;
}
