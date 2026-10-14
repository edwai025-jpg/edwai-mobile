import type { DocumentPickerAsset } from "expo-document-picker";
import { Platform } from "react-native";
import { FileSystemSessionType, FileSystemUploadType, getInfoAsync, uploadAsync } from "expo-file-system/legacy";

export class PdfUploadError extends Error {}

export type PdfUploadResponse = Pick<Response, "status" | "ok" | "text">;

/** Send a picked PDF once; a lost response must never cause an automatic replay. */
export async function sendPdfUpload(
  url: string,
  token: string,
  asset: DocumentPickerAsset,
  title: string,
  bookType: string,
): Promise<PdfUploadResponse> {
  if (!/\.pdf$/i.test(asset.name)) {
    throw new PdfUploadError("Please choose a PDF file.");
  }
  if (!title.trim()) {
    throw new PdfUploadError("Enter a title for your PDF.");
  }

  if (Platform.OS === "web") {
    const file = asset.file ?? await (await fetch(asset.uri)).blob();
    if (file.size <= 0) throw new PdfUploadError("This PDF is empty. Please choose another file.");
    const form = new FormData();
    form.append("file", file, asset.name);
    form.append("title", title.trim());
    form.append("book_type", bookType);
    // The browser supplies the multipart boundary. Never send a JSON header.
    return fetch(url, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
  }

  const info = await getInfoAsync(asset.uri);
  if (!info.exists || info.isDirectory || !Number.isFinite(info.size) || info.size <= 0) {
    throw new PdfUploadError("This PDF could not be read. Please select the file again.");
  }
  // PDFs can be much larger than photos. Let the native uploader read the
  // cached file instead of loading/duplicating the whole PDF in JavaScript.
  // It supplies the multipart boundary and file bytes without FormData objects.
  const response = await uploadAsync(url, asset.uri, {
    httpMethod: "POST",
    // iOS background sessions can retry a failed write indefinitely.
    sessionType: FileSystemSessionType.FOREGROUND,
    uploadType: FileSystemUploadType.MULTIPART,
    fieldName: "file",
    mimeType: "application/pdf",
    parameters: { title: title.trim(), book_type: bookType },
    headers: { Authorization: `Bearer ${token}` },
  });
  return {
    status: response.status,
    ok: response.status >= 200 && response.status < 300,
    text: async () => response.body,
  };
}
