import { Platform } from "react-native";

const PROD_URL = "https://edwai-api-953672603784.asia-south1.run.app";

const PROXY_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api-server/api/edwai`
  : null;

function resolveUrl(path: string): string {
  if (Platform.OS === "web" && PROXY_BASE) {
    return `${PROXY_BASE}${path.replace(/^\/api/, "")}`;
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
  date: string;
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
  id: string;
  device_info?: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
  last_used_at?: string;
  is_current?: boolean;
};

export type UsageInfo = {
  status: "active" | "grace_period" | "past_due" | "free" | "cancelled";
  plan_name: string;
  questions_used: number;
  questions_limit: number;
  renewal_date?: string;
  payment_method_update_url?: string;
  days_remaining?: number;
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
  subject?: string;
  document_type?: string;
  source_type: "pdf" | "youtube";
  processing_status: "pending" | "processing" | "completed" | "failed";
  progress_percent?: number;
  page_count?: number;
  chunk_count?: number;
  created_at: string;
  is_ready: boolean;
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
  base64_images?: {
    page: number;
    data: string;
    ncert_url?: string;
  }[];
};

export type DiagramImage = {
  page: number;
  data: string;
};

export type CitationImage = {
  page_number: number;
  base64_image: string;
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
  sources?: PageCitation[];
  diagram_images?: DiagramImage[];
  citation_images?: CitationImage[];
  validation?: ValidationResult;
  cached?: boolean;
};

export type Flashcard = {
  type: "definition" | "concept" | "process" | "fact" | "diagram";
  front: string;
  back: string;
};

export type QueryHistoryItem = {
  id: number;
  question: string;
  mode: "retrieve" | "explain";
  created_at: string;
};

async function request<T>(
  path: string,
  options: RequestInit = {},
  accessToken?: string
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
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
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = { detail: text };
  }

  if (!res.ok) {
    const detail = (data as { detail?: string })?.detail ?? `HTTP ${res.status}`;
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

export async function streamQuery(
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
    const text = await res.text();
    let detail = `HTTP ${res.status}`;
    try {
      detail = (JSON.parse(text) as { detail?: string }).detail ?? detail;
    } catch {}
    throw new ApiError(detail, res.status, null);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response stream");

  const decoder = new TextDecoder();
  let buffer = "";
  let fullAnswer = "";
  let responseData: Partial<QueryResponse> = {};

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (payload === "[DONE]") break;
      try {
        const parsed = JSON.parse(payload) as {
          chunk?: string;
          answer?: string;
          sources?: PageCitation[];
          diagram_images?: DiagramImage[];
          citation_images?: CitationImage[];
          validation?: ValidationResult;
          cached?: boolean;
        };
        if (parsed.chunk) {
          fullAnswer += parsed.chunk;
          onChunk(parsed.chunk);
        } else {
          responseData = { ...responseData, ...parsed };
        }
      } catch {}
    }
  }

  return {
    answer: responseData.answer ?? fullAnswer,
    sources: responseData.sources,
    diagram_images: responseData.diagram_images,
    citation_images: responseData.citation_images,
    validation: responseData.validation,
    cached: responseData.cached,
  };
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

    refreshToken: (refresh_token: string) =>
      request<{ access_token: string; token_type: string; user: ApiUser }>(
        "/api/auth/token/refresh",
        {
          method: "POST",
          body: JSON.stringify({ refresh_token }),
        }
      ),

    getMe: (accessToken: string) =>
      request<ApiUser>("/api/auth/me", {}, accessToken),

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
        full_name: string;
        state_id?: number | null;
        board_id: number;
        class_id?: number | null;
        phone?: string;
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
      request<{ message: string }>(
        "/api/auth/phone/verify-for-profile",
        {
          method: "POST",
          body: JSON.stringify({ phone, otp }),
        },
        accessToken
      ),
  },

  data: {
    getStates: () => request<StateItem[]>("/api/states"),
    getBoards: (stateId: number) => request<BoardItem[]>(`/api/boards/${stateId}`),
    getClasses: (boardId: number) => request<ClassItem[]>(`/api/classes/${boardId}`),
    getClassesForBoard: (boardId: number) =>
      request<ClassItem[]>(`/api/classes?board_id=${boardId}`),
    getMediums: (boardId: number, classId: number) =>
      request<MediumItem[]>(`/api/medium?board_id=${boardId}&class_id=${classId}`),
    getWhatsNew: () => request<WhatsNewResponse>("/api/whats-new"),
    getAppConfig: () => request<AppConfig>("/api/app-config"),
  },

  profile: {
    updateStudentProfile: (
      token: string,
      data: {
        state_id?: number;
        board_id?: number;
        class_id?: number;
        medium_id?: number;
        full_name?: string;
        email?: string;
      }
    ) =>
      request<{ message: string; user: ApiUser }>(
        "/api/student/profile",
        { method: "PUT", body: JSON.stringify(data) },
        token
      ),

    uploadPhoto: (token: string, imageUri: string) => {
      const formData = new FormData();
      formData.append("photo", {
        uri: imageUri,
        type: "image/jpeg",
        name: "photo.jpg",
      } as unknown as Blob);
      return request<{ profile_photo_url: string }>(
        "/api/student/profile/photo",
        { method: "POST", body: formData, headers: {} },
        token
      );
    },

    deletePhoto: (token: string) =>
      request<{ message: string }>(
        "/api/student/profile/photo",
        { method: "DELETE" },
        token
      ),

    getSessions: (token: string) =>
      request<SessionInfo[]>("/api/auth/sessions", {}, token),

    deleteSession: (token: string, sessionId: string) =>
      request<{ message: string }>(
        `/api/auth/sessions/${sessionId}`,
        { method: "DELETE" },
        token
      ),

    deleteAccount: (token: string) =>
      request<{ message: string }>(
        "/api/student/account",
        { method: "DELETE" },
        token
      ),

    toggleAutopay: (token: string, enabled: boolean) =>
      request<{ message: string; autopay_enabled: boolean }>(
        "/api/billing/autopay/toggle",
        { method: "POST", body: JSON.stringify({ enabled }) },
        token
      ),

    sendPhoneOtp: (token: string, phone: string) =>
      request<{ message: string }>(
        "/api/auth/phone/send-otp-profile",
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
      request<UsageInfo>("/api/usage", {}, token),

    getBoardStatus: (token: string) =>
      request<BoardStatus>("/api/student/board/status", {}, token),

    startBoardProcessing: (token: string) =>
      request<{ message: string; estimated_minutes: number }>(
        "/api/student/board/process",
        { method: "POST" },
        token
      ),

    getDocuments: (token: string, boardId: number, classId: number, subject?: string) => {
      const qs = subject
        ? `board_id=${boardId}&class_id=${classId}&subject=${encodeURIComponent(subject)}`
        : `board_id=${boardId}&class_id=${classId}`;
      return request<Phase1Document[]>(`/api/documents?${qs}`, {}, token);
    },

    getQueryHistory: (token: string, documentId: number) =>
      request<QueryHistoryItem[]>(
        `/api/query-history?document_id=${documentId}`,
        {},
        token
      ),

    streamQuery: (
      token: string,
      body: { document_id: number; question: string; mode: "retrieve" | "explain" },
      onChunk: (chunk: string) => void,
      signal?: AbortSignal
    ) => streamQuery("/api/query", body, token, onChunk, signal),

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
        "/api/generate-flashcards",
        { method: "POST", body: JSON.stringify({ question, answer }) },
        token
      ),

    transliterate: (token: string, lang: string, word: string) =>
      request<string[]>(`/api/transliterate/${lang}/${encodeURIComponent(word)}`, {}, token),
  },

  phase2: {
    listDocuments: (token: string) =>
      request<DocumentItem[]>("/api/phase2/documents", {}, token),

    addYoutube: (token: string, url: string, title?: string) =>
      request<DocumentItem>(
        "/api/phase2/documents/youtube",
        { method: "POST", body: JSON.stringify({ url, title }) },
        token
      ),

    uploadPdf: (token: string, fileUri: string, fileName: string, title: string, documentType: string) => {
      const formData = new FormData();
      formData.append("file", {
        uri: fileUri,
        type: "application/pdf",
        name: fileName,
      } as unknown as Blob);
      formData.append("title", title);
      formData.append("document_type", documentType);
      return request<DocumentItem>(
        "/api/phase2/documents/upload",
        { method: "POST", body: formData, headers: {} },
        token
      );
    },

    deleteDocument: (token: string, id: number) =>
      request<{ message: string }>(
        `/api/phase2/documents/${id}`,
        { method: "DELETE" },
        token
      ),

    getQueryHistory: (token: string, documentId: number) =>
      request<QueryHistoryItem[]>(
        `/api/phase2/query-history?document_id=${documentId}`,
        {},
        token
      ),

    streamQuery: (
      token: string,
      body: { document_id: number; question: string; mode: "retrieve" | "explain" },
      onChunk: (chunk: string) => void,
      signal?: AbortSignal
    ) => streamQuery("/api/phase2/query", body, token, onChunk, signal),
  },

  googleAuthUrl: `${PROD_URL}/api/auth/google`,
  googleRedirectBase: "https://edwai-prod-70474.web.app",
};

export default api;
