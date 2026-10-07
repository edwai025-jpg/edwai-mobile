import type { ImagePickerAsset } from "expo-image-picker";
import { Platform } from "react-native";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

function validatePhoto(type: string, size: number | undefined) {
  if (!PHOTO_TYPES.includes(type)) {
    throw new Error("Choose a JPEG, PNG or WebP photo.");
  }
  if (size === undefined || !Number.isFinite(size) || size <= 0) {
    throw new Error("Could not determine the photo size. Please choose another photo.");
  }
  if (size > MAX_PHOTO_BYTES) {
    throw new Error("Photo must be 5 MiB or smaller.");
  }
}

export async function prepareProfilePhotoUpload(asset: ImagePickerAsset): Promise<FormData> {
  const data = new FormData();
  if (Platform.OS === "web") {
    // The browser needs a real Blob/File, not React Native's { uri, type, name }.
    const file = asset.file ?? await (await fetch(asset.uri)).blob();
    validatePhoto(file.type, file.size);
    data.append("file", file, asset.fileName ?? "profile-photo");
  } else {
    const extension = (asset.fileName ?? asset.uri).split(".").pop()?.toLowerCase();
    const type = asset.mimeType ?? (
      extension === "jpg" || extension === "jpeg" ? "image/jpeg"
        : extension === "png" ? "image/png"
          : extension === "webp" ? "image/webp" : ""
    );
    validatePhoto(type, asset.fileSize);
    data.append("file", {
      uri: asset.uri,
      type,
      name: asset.fileName ?? `photo.${type.split("/")[1]}`,
    } as unknown as Blob);
  }
  return data;
}
