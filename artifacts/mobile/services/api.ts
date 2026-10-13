import { Platform } from "react-native";
import type { ImagePickerAsset } from "expo-image-picker";
import { prepareProfilePhotoUpload } from "./profilePhotoUpload";
import { readAnswerStream } from "./answerStream";

const PROD_URL = "https://edwai-api-953672603784.asia-south1.run.app";
export const PHOTO_ENDPOINT = `${PROD_URL}/api/student/profile/photo`;

/** The storage key in /auth/me is not an image URL. Keep credentials in headers. */
export function getProfilePhotoSource(token: string, userId?: number, revision = 0) {
  return {
    uri: resolveUrl("/api/student/profile/photo"),
    headers: { Authorization: `Bearer ${token}` },
    cacheKey: `student-photo:${userId ?? "current"}:${revision}`,
  };
}

const PROXY_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api/edwai`
  : null;

export function resolveUrl(path: string): string {
  const apiPath = path.replace(/^\/api/, "");

  if (Platform.OS === "web") {
    /* 1. Prefer the env-var-configured proxy (set at bundle time) */
    if (PROXY_BASE) {
      return `${PROXY_BASE}${apiPath}`;
    }
    /* 2. Fallback: derive proxy from window.location so web canvas always
          routes through the API-server proxy and avoids production-API CORS.
          Replit Expo web domain:  *.expo.janeway.replit.dev
          Replit proxy domain:     *.janeway.replit.dev  (drops "expo." prefix) */
    if (typeof window !== "undefined" && window.location?.hostname) {
      const h = window.location.hostname;
      const proxyHost = h.replace(/\.expo\.janeway\.replit\.dev$/, ".janeway.replit.dev");
      if (proxyHost !== h) {
        return `https://${proxyHost}/api/edwai${apiPath}`;
      }
      /* Generic Replit preview — same origin proxy path */
      if (h.endsWith(".replit.dev") || h.endsWith(".janeway.replit.dev")) {
        return `https://${h}/api/edwai${apiPath}`;
      }
    }
  }

  // Native builds may use the supplied public API base (with or without /api).
  // Web previews continue through the existing proxy for CORS isolation.
  const configured = process.env.EXPO_PUBLIC_EDUWAI_API_BASE_URL?.trim().replace(/\/+$/, "");
  if (configured) {
    const url = new URL(configured);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
      throw new Error("The EDUwAI API base must be a public HTTPS URL without credentials or query parameters.");
    }
    const base = url.pathname === "/" ? `${url.origin}/api` : configured;
    return `${base}${apiPath}`;
  }
  return `${PROD_URL}${path}`;
}

export type ApiUser = {
  id: number;
  email?: string;
  phone?: string;
  full_name?: string;
  state?: string;
  state_id?: number;
  board?: string;
  board_id?: number;
  class_id?: number;
  class_name?: string;
  medium_id?: number;
  medium_name?: string;
  is_admin: boolean;
  role: string;
  org_role?: string | null;
  org_id?: number | null;
  org_name?: string | null;
  is_pre_registered?: boolean;
  terms_accepted_at?: string | null;
  org_subdomain?: string | null;
  auth_provider: "phone" | "email" | "google";
  phone_verified: boolean;
  email_verified: boolean;
  profile_complete: boolean;
  google_id?: boolean;
  profile_photo_url?: string;
};

export type AuthResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  is_new_user: boolean;
  profile_complete: boolean;
  user: ApiUser;
};

export type WhatsNewItem = {
  name: string;
  state: string;
  type: "board" | "class";
  date: string | null;
  created_at?: string | null;
  is_new: boolean;
};

export type WhatsNewResponse = {
  items: WhatsNewItem[];
  total_boards: number;
};

export type AppConfig = {
  social_youtube?: string;
  social_telegram?: string;
  social_instagram?: string;
  social_resources?: string;
  [key: string]: string | undefined;
};

export type StateItem = { id: number; name: string };
export type BoardItem = {
  id: number;
  name: string;
  is_restricted: boolean;
  processing_delay_minutes: number;
  page_display_mode: string;
};
export type ClassItem = { id: number; name: string };
export type MediumItem = { id: number; name: string };

export type SessionInfo = {
  id: number;
  device_hint: string;
  auth_method: string;
  ip_address: string | null;
  created_at: string | null;
  last_used_at: string | null;
  is_current: boolean;
};

export type UsageInfo = {
  status: "active" | "grace_period" | "past_due" | "free" | "cancelled";
  tier_slug?: string;
  tier_name?: string;
  plan_name?: string;
  questions_used: number;
  question_limit: number;
  questions_limit?: number;
  percent_used?: number;
  period_start?: string;
  period_end?: string;
  days_remaining?: number;
  grace_period_ends?: string | null;
  payment_method_update_url?: string | null;
  autopay_enabled?: boolean;
  warning_80_sent?: boolean;
  limit_reached_sent?: boolean;
  renewal_date?: string;
};

export type BoardStatus = {
  is_restricted: boolean;
  processing_status: "not_started" | "in_progress" | "completed" | "failed";
  processing_delay_minutes: number;
  progress_percent?: number;
  started_at?: string;
};

export type DocumentItem = {
  id: number;
  title: string;
  book_type?: string;
  source_type: "pdf" | "youtube";
  youtube_url?: string | null;
  file_size_bytes?: number;
  page_count?: number;
  processing_status: "uploaded" | "processing" | "completed" | "failed";
  processing_progress?: number;
  is_ready: boolean;
  created_at: string;
  last_queried_at?: string | null;
};

export type Phase2Status = {
  enabled: boolean;
  max_file_size_mb: number;
  max_books_per_user: number;
  max_videos_per_user: number;
  answer_model: string;
};

export type Phase1Document = {
  id: number;
  title: string;
  subject: string;
  class_id: number;
  board_id: number;
  page_display_mode?: string;
};

export type PageCitation = {
  page: number;
  base64_images?: Phase1CitationImage[];
};

export type DiagramImage = {
  page: number;
  data: string;
};

export type CitationImage = {
  page_number: number;
  base64_image: string;
};

export type Phase1CitationImage = {
  page: number;
  pdf_page?: number;
  data: string | null;
  filename?: string;
  ncert_url?: string;
  image_role?: string;
};

export type QueryImagesResponse = {
  diagram_images: DiagramImage[];
  citation_images: Phase1CitationImage[];
  page_display_mode?: string;
};

export type TypographySettings = {
  font_size: string;
  line_height: string;
  font_family: string;
};

export type DisclaimerMessages = {
  ai_warning_text: string;
  page_context_text: string;
  source_citation_text: string;
};

export type BoardPageConfig = {
  board_id: number;
  page_display_mode: "original" | "edwai_generated" | "embedded";
  ncert_book_code: string | null;
};

export type ValidationResult = {
  is_reliable: boolean;
  confidence: number;
  validated_facts: number;
  partial_facts: number;
  unverified_facts: number;
  warnings: string[];
};

export type QueryResponse = {
  answer: string;
  /** Client-only transport marker; JSON responses already contain backend presentation data. */
  answerTransport?: "json";
  language?: string;
  answer_language?: string;
  sources?: PageCitation[];
  diagram_images?: DiagramImage[];
  citation_images?: CitationImage[];
  phase1_citations?: Phase1CitationImage[];
  validation?: ValidationResult;
  cached?: boolean;
  image_source_pages?: number[];
  image_primary_pages?: number[];
  is_visual_question?: boolean;
  document_id?: number;
  answer_not_found?: boolean;
  material_not_found?: boolean;
  general_fallback?: boolean;
};

export type Flashcard = {
  type: "definition" | "concept" | "process" | "fact" | "diagram";
  front: string;
  back: string;
};

export type QueryHistoryItem = {
  id: number;
  question: string;
  mode: string | null;
  answer_preview?: string | null;
  sources?: (number | null)[] | null;
  is_bookmarked: boolean;
  created_at: string | null;
};
export type BookmarkResult = { id: number; is_bookmarked: boolean };

async function request<T>(
  path: string,
  options: RequestInit = {},
  accessToken?: string
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers as Record<string, string> | undefined),
  };
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const res = await fetch(resolveUrl(path), {
    ...options,
    headers,
  });

  const text = await res.text();
  if (res.status === 204) return undefined as T;
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    if (res.ok) {
      throw new ApiError("The API returned an unexpected response. Please try again.", res.status, null);
    }
    data = { detail: text };
  }

  if (!res.ok) {
    const rawDetail = (data as { detail?: unknown })?.detail;
    const detail = typeof rawDetail === "string" ? rawDetail
      : Array.isArray(rawDetail)
        ? rawDetail.map((item: { msg?: string }) => item?.msg).filter(Boolean).join("; ") || `HTTP ${res.status}`
        : `HTTP ${res.status}`;
    throw new ApiError(detail, res.status, data);
  }

  return data as T;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public data: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/* ── Generic SSE streaming helper ─────────────────────────────────────── */
async function fetchStream(
  path: string,
  body: Record<string, unknown>,
  accessToken: string,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal
): Promise<QueryResponse> {
  const url = resolveUrl(path);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      Accept: "text/event-stream",
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const errText = await res.text();
    let detail = `HTTP ${res.status}`;
    try {
      const parsed = JSON.parse(errText) as { detail?: string | { message?: string } };
      if (typeof parsed.detail === "string") detail = parsed.detail;
      else if (typeof parsed.detail === "object" && parsed.detail?.message) detail = parsed.detail.message;
    } catch {}
    throw new ApiError(detail, res.status, null);
  }

  return readAnswerStream(res, onChunk, signal);
}

/* ── Phase 1 query stream ──────────────────────────────────────────────── */
export async function streamQuery(
  path: string,
  body: Record<string, unknown>,
  accessToken: string,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal
): Promise<QueryResponse> {
  return fetchStream(path, body, accessToken, onChunk, signal);
}

/* ── Phase 2 query stream ──────────────────────────────────────────────── */
export async function streamQueryPhase2(
  documentId: number,
  body: { question: string; mode: "retrieve" | "explain" },
  accessToken: string,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal
): Promise<QueryResponse> {
  const path = `/api/phase2/documents/${documentId}/query/stream`;
  return fetchStream(path, body, accessToken, onChunk, signal);
}

const api = {
  auth: {
    sendPhoneOtp: (phone: string) =>
      request<{ message: string }>("/api/auth/phone/send-otp", {
        method: "POST",
        body: JSON.stringify({ phone }),
      }),

    verifyPhoneOtp: (phone: string, otp: string) =>
      request<AuthResponse>("/api/auth/phone/verify-otp", {
        method: "POST",
        body: JSON.stringify({ phone, otp }),
      }),

    sendEmailOtp: (email: string) =>
      request<{ message: string }>("/api/auth/email/send-otp", {
        method: "POST",
        body: JSON.stringify({ email }),
      }),

    verifyEmailOtp: (email: string, otp: string) =>
      request<AuthResponse>("/api/auth/email/verify-otp", {
        method: "POST",
        body: JSON.stringify({ email, otp }),
      }),

    refreshToken: (refresh_token: string, signal?: AbortSignal) =>
      request<{ access_token: string; token_type: string; user: ApiUser }>(
        "/api/auth/token/refresh",
        {
          method: "POST",
          body: JSON.stringify({ refresh_token }),
          signal,
        }
      ),

    getMe: (accessToken: string, signal?: AbortSignal) =>
      request<ApiUser>("/api/auth/me", { signal }, accessToken),

    logout: (accessToken: string, refresh_token: string) =>
      request<{ message: string }>(
        "/api/auth/logout",
        {
          method: "POST",
          body: JSON.stringify({ refresh_token }),
        },
        accessToken
      ),

    saveProfile: (
      accessToken: string,
      data: {
        full_name?: string;
        state_id?: number | null;
        board_id?: number | null;
        class_id?: number | null;
        phone?: string;
        terms_accepted?: boolean;
      }
    ) =>
      request<{ success: boolean; profile_complete: boolean; user: ApiUser }>(
        "/api/auth/me/profile",
        {
          method: "PATCH",
          body: JSON.stringify(data),
        },
        accessToken
      ),

    verifyPhoneForProfile: (
      accessToken: string,
      phone: string,
      otp: string
    ) =>
      request<{ success: boolean; user: ApiUser }>(
        "/api/auth/phone/verify-for-profile",
        {
          method: "POST",
          body: JSON.stringify({ phone, otp }),
        },
        accessToken
      ),
  },

  onboarding: {
    requestCurriculum: (
      accessToken: string,
      data: {
        state_id: number | null;
        board_id: number | null;
        board_name: string | null;
        class_name_requested: string | null;
      },
    ) => request<{ success: boolean; id: number }>("/api/class-requests", {
      method: "POST",
      body: JSON.stringify(data),
    }, accessToken),
  },

  data: {
    getStates: () => request<StateItem[]>("/api/states"),
    getBoards: (stateId: number) => request<BoardItem[]>(`/api/boards/${stateId}`),
    getClasses: (boardId: number) => request<ClassItem[]>(`/api/classes/${boardId}`),
    getClassesForBoard: (boardId: number) =>
      request<ClassItem[]>(`/api/classes?board_id=${boardId}`),
    getMediums: (boardId: number, classId: number) =>
      request<MediumItem[]>(`/api/mediums?board_id=${boardId}&class_id=${classId}`),
    getWhatsNew: () => request<WhatsNewResponse>("/api/whats-new"),
    getAppConfig: () => request<AppConfig>("/api/app-config"),
  },

  profile: {
    updateAccount: async (
      token: string,
      data: {
        full_name?: string;
        email?: string;
      }
    ): Promise<{ user: ApiUser }> => {
      // The live OpenAPI specifies the input but not the write response.
      // Read the canonical user instead of assuming that response has a user.
      await request<unknown>(
        "/api/student/profile/account",
        { method: "PUT", body: JSON.stringify(data) },
        token
      );
      return { user: await request<ApiUser>("/api/auth/me", {}, token) };
    },

    /* Correct endpoint for saving education details (board + class + medium) */
    saveEducation: (
      token: string,
      data: { board_id: number; class_id?: number | null; medium_id?: number | null }
    ) =>
      request<{ user: ApiUser }>(
        "/api/student/profile/education",
        { method: "PUT", body: JSON.stringify(data) },
        token
      ),

    probePhoto: async (token: string): Promise<boolean> => {
      const response = await fetch(resolveUrl("/api/student/profile/photo"), {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (response.status === 404) return false;
      if (!response.ok) throw new Error(`Could not load photo (HTTP ${response.status}).`);
      return true;
    },

    uploadPhoto: async (token: string, asset: ImagePickerAsset) => {
      const formData = await prepareProfilePhotoUpload(asset);
      return request<{ success: boolean; profile_photo_url: string }>(
        "/api/student/profile/photo",
        { method: "POST", body: formData, headers: {} },
        token
      );
    },

    deletePhoto: (token: string) =>
      request<{ success: boolean }>(
        "/api/student/profile/photo",
        { method: "DELETE" },
        token
      ),

    getSessions: async (token: string): Promise<SessionInfo[]> => {
      const result = await request<unknown>("/api/auth/sessions", {}, token);
      if (!Array.isArray(result) || !result.every((row) =>
        row !== null && typeof row === "object"
        && Number.isInteger(row.id)
        && typeof row.device_hint === "string"
        && typeof row.auth_method === "string"
        && typeof row.is_current === "boolean"
        && (row.ip_address === null || typeof row.ip_address === "string")
        && (row.created_at === null || typeof row.created_at === "string")
        && (row.last_used_at === null || typeof row.last_used_at === "string")
      )) {
        throw new Error("The sessions response could not be read. Please try again.");
      }
      return result as SessionInfo[];
    },

    deleteSession: (token: string, sessionId: number) =>
      request<{ success: boolean }>(
        `/api/auth/sessions/${sessionId}`,
        { method: "DELETE" },
        token
      ),

    deleteAccount: (token: string) =>
      request<{ message: string }>(
        "/api/student/profile",
        { method: "DELETE" },
        token
      ),

    toggleAutopay: (token: string) =>
      request<{ success: boolean; autopay_enabled: boolean }>(
        "/api/billing/autopay",
        { method: "PATCH" },
        token
      ),

    logoutAll: (token: string) =>
      request<{ success: boolean; sessions_revoked: number }>("/api/auth/logout-all", { method: "POST" }, token),

    sendPhoneOtp: (token: string, phone: string) =>
      request<{ message: string }>(
        "/api/auth/phone/send-otp",
        { method: "POST", body: JSON.stringify({ phone }) },
        token
      ),

    verifyPhoneOtp: (token: string, phone: string, otp: string) =>
      request<{ message: string }>(
        "/api/auth/phone/verify-for-profile",
        { method: "POST", body: JSON.stringify({ phone, otp }) },
        token
      ),
  },

  study: {
    getUsage: (token: string) =>
      request<UsageInfo>("/api/billing/usage/me", {}, token),

    getBoardStatus: (token: string) =>
      request<BoardStatus>("/api/student/board-status", {}, token),

    startBoardProcessing: (token: string) =>
      request<{ message: string; estimated_minutes: number }>(
        "/api/student/board/process",
        { method: "POST" },
        token
      ),

    /* Server automatically applies board_id + medium_id from saved profile */
    getAvailableClasses: (token: string) =>
      request<{ id: number; name: string }[]>("/api/student/available-classes", {}, token),

    getAvailableSubjects: (token: string, classId: number) =>
      request<string[]>(`/api/student/available-subjects?class_id=${classId}`, {}, token),

    /* Server applies board_id + medium_id from saved profile — only pass class_id + subject */
    getDocuments: (token: string, classId: number, subject?: string) => {
      const params = new URLSearchParams();
      params.set("class_id", String(classId));
      if (subject) params.set("subject", subject);
      return request<Phase1Document[]>(`/api/documents?${params.toString()}`, {}, token);
    },

    getQueryHistory: (token: string, documentId: number, signal?: AbortSignal) =>
      request<QueryHistoryItem[]>(
        `/api/query-history/${documentId}`,
        { signal },
        token
      ),

    toggleBookmark: (token: string, historyId: number) =>
      request<BookmarkResult>(`/api/query-history/${historyId}/bookmark`, { method: "POST" }, token),

    streamQuery: (
      token: string,
      body: { document_id: number; question: string; mode: "retrieve" | "explain" },
      onChunk: (chunk: string) => void,
      signal?: AbortSignal
    ) => streamQuery("/api/query/stream", body, token, onChunk, signal),

    extractQuestionFromImage: (token: string, imageUri: string) => {
      const formData = new FormData();
      formData.append("image", {
        uri: imageUri,
        type: "image/jpeg",
        name: "question.jpg",
      } as unknown as Blob);
      return request<{ text: string }>(
        "/api/extract-question-from-image",
        { method: "POST", body: formData, headers: {} },
        token
      );
    },

    generateFlashcards: (token: string, question: string, answer: string) =>
      request<{ flashcards: Flashcard[] }>(
        "/api/flashcards",
        { method: "POST", body: JSON.stringify({ question, answer }) },
        token
      ),

    transliterate: (token: string, lang: string, word: string, signal?: AbortSignal) =>
      request<{ result: string[]; success: boolean; error?: string }>(
        `/api/transliterate/${lang}/${encodeURIComponent(word)}?num_suggestions=5`, { signal }, token),

    getVoiceQuestionUsage: (token: string, signal?: AbortSignal) =>
      request<import("./inputModes").VoiceQuestionUsage>("/api/billing/voice-question-usage", { signal }, token),

    transcribeVoiceQuestion: (token: string, body: FormData, signal?: AbortSignal) =>
      request<import("./inputModes").VoiceQuestionResult>("/api/transcribe-voice-question", { method: "POST", body, signal }, token),

    getTypographySettings: (token: string) =>
      request<TypographySettings>("/api/typography-settings", {}, token),

    getDisclaimerMessages: (token: string, signal?: AbortSignal) =>
      request<DisclaimerMessages>("/api/disclaimer-messages", { signal }, token),

    getBoardPageConfig: (token: string, boardId: number, signal?: AbortSignal) =>
      request<BoardPageConfig>(`/api/boards/${boardId}/page-config`, { signal }, token),

    fetchAiPage: async (token: string, documentId: number, filename: string, signal?: AbortSignal): Promise<string> => {
      const response = await fetch(resolveUrl(`/api/ai-images/${documentId}/${filename}`), {
        headers: { Authorization: `Bearer ${token}`, Accept: "image/png" }, signal,
      });
      if (!response.ok) throw new ApiError(`Could not load study page (HTTP ${response.status}).`, response.status, null);
      const blob = await response.blob();
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        const aborted = () => {
          reader.abort();
          const error = new Error("Study page request cancelled");
          error.name = "AbortError";
          reject(error);
        };
        const cleanup = () => signal?.removeEventListener("abort", aborted);
        reader.onload = () => { cleanup(); resolve(String(reader.result)); };
        reader.onerror = () => { cleanup(); reject(new Error("Could not decode study page.")); };
        reader.onabort = () => { cleanup(); const error = new Error("Study page request cancelled"); error.name = "AbortError"; reject(error); };
        if (signal?.aborted) { aborted(); return; }
        signal?.addEventListener("abort", aborted, { once: true });
        reader.readAsDataURL(blob);
      });
    },

    fetchQueryImages: (token: string, body: { document_id: number; pages: number[]; primary_pages?: number[]; include_diagrams: boolean }, signal?: AbortSignal) =>
      request<QueryImagesResponse>("/api/query/images", { method: "POST", body: JSON.stringify(body), signal }, token),
  },

  phase2: {
    getStatus: (token: string) =>
      request<Phase2Status>("/api/phase2/status", {}, token),

    listDocuments: (token: string) =>
      request<DocumentItem[]>("/api/phase2/documents", {}, token),

    getDocument: (token: string, id: number) =>
      request<DocumentItem>(`/api/phase2/documents/${id}`, {}, token),

    addYoutube: (token: string, url: string, title?: string) =>
      request<DocumentItem>(
        "/api/phase2/documents/youtube",
        { method: "POST", body: JSON.stringify({ url, title }) },
        token
      ),

    uploadPdf: (token: string, fileUri: string, fileName: string, title: string, bookType: string) => {
      const formData = new FormData();
      formData.append("file", {
        uri: fileUri,
        type: "application/pdf",
        name: fileName,
      } as unknown as Blob);
      formData.append("title", title);
      formData.append("book_type", bookType);
      return request<DocumentItem>(
        "/api/phase2/documents/upload",
        { method: "POST", body: formData, headers: {} },
        token
      );
    },

    deleteDocument: (token: string, id: number) =>
      request<{ status: string; message: string }>(
        `/api/phase2/documents/${id}`,
        { method: "DELETE" },
        token
      ),

    getQueryHistory: (token: string, documentId: number, signal?: AbortSignal) =>
      request<QueryHistoryItem[]>(
        `/api/phase2/documents/${documentId}/query-history`,
        { signal },
        token
      ),

    toggleBookmark: (token: string, historyId: number) =>
      request<BookmarkResult>(`/api/phase2/history/${historyId}/bookmark`, { method: "POST" }, token),

    streamQuery: (
      token: string,
      body: { document_id: number; question: string; mode: "retrieve" | "explain" },
      onChunk: (chunk: string) => void,
      signal?: AbortSignal
    ) => streamQueryPhase2(body.document_id, { question: body.question, mode: body.mode }, token, onChunk, signal),
  },

  googleAuthUrl: `${PROD_URL}/api/auth/google`,
  googleRedirectBase: "https://edwai-prod-70474.web.app",
};

export default api;
