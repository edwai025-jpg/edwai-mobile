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

export type ProfilePhotoUpload = {
  body: FormData | Uint8Array<ArrayBuffer>;
  headers: Record<string, string>;
};

export async function prepareProfilePhotoUpload(asset: ImagePickerAsset): Promise<ProfilePhotoUpload> {
  if (Platform.OS === "web") {
    // The browser needs a real Blob/File, not React Native's { uri, type, name }.
    const file = asset.file ?? await (await fetch(asset.uri)).blob();
    validatePhoto(file.type.toLowerCase(), file.size);
    const data = new FormData();
    data.append("file", file, asset.fileName ?? "profile-photo");
    return { body: data, headers: {} };
  } else {
    // Native runtimes do not agree on FormData file objects. Encode this one
    // bounded file ourselves: both Expo fetch and RN fetch accept byte bodies.
    // Never replay a failed POST using another transport.
    const file = new File(asset.uri);
    const type = asset.mimeType?.toLowerCase() ?? "";
    validatePhoto(type, file.size);
    const bytes = await file.bytes();
    validatePhoto(type, bytes.byteLength);
    const boundary = `----EDUwAIPhoto${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
    const filename = encodeURIComponent((asset.fileName ?? `photo.${type.split("/")[1]}`).replace(/[\\/]/g, "_"));
    const encoder = new TextEncoder();
    const prefix = encoder.encode(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${type}\r\n\r\n`);
    const suffix = encoder.encode(`\r\n--${boundary}--\r\n`);
    const body = new Uint8Array(prefix.byteLength + bytes.byteLength + suffix.byteLength);
    body.set(prefix);
    body.set(bytes, prefix.byteLength);
    body.set(suffix, prefix.byteLength + bytes.byteLength);
    return { body, headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` } };
  }
}
