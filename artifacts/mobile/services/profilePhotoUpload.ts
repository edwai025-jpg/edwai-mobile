import type { ImagePickerAsset } from "expo-image-picker";
import { Platform } from "react-native";
import { File } from "expo-file-system";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
export class PhotoValidationError extends Error {}

function validatePhoto(type: string, size: number | undefined) {
  if (!PHOTO_TYPES.includes(type)) {
    throw new PhotoValidationError("Choose a JPEG, PNG or WebP photo.");
  }
  if (size === undefined || !Number.isFinite(size) || size <= 0) {
    throw new PhotoValidationError("Could not determine the photo size. Please choose another photo.");
  }
  if (size > MAX_PHOTO_BYTES) {
    throw new PhotoValidationError("Photo must be 5 MiB or smaller.");
  }
}

export async function prepareProfilePhotoUpload(asset: ImagePickerAsset): Promise<FormData> {
  const data = new FormData();
  if (Platform.OS === "web") {
    // The browser needs a real Blob/File, not React Native's { uri, type, name }.
    const file = asset.file ?? await (await fetch(asset.uri)).blob();
    validatePhoto(file.type.toLowerCase(), file.size);
    data.append("file", file, asset.fileName ?? "profile-photo");
  } else {
    // Inspect actual cached bytes; picker size metadata is not authoritative.
    const file = new File(asset.uri);
    const type = asset.mimeType?.toLowerCase() ?? "";
    validatePhoto(type, file.size);
    data.append("file", {
      type,
      name: asset.fileName ?? `photo.${type.split("/")[1]}`,
      bytes: () => file.bytes(),
    } as unknown as Blob);
  }
  return data;
}
