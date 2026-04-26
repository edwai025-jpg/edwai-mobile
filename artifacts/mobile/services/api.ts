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

    getBoards: (stateId: number) =>
      request<BoardItem[]>(`/api/boards/${stateId}`),

    getClasses: (boardId: number) =>
      request<ClassItem[]>(`/api/classes/${boardId}`),

    getWhatsNew: () => request<WhatsNewResponse>("/api/whats-new"),

    getAppConfig: () => request<AppConfig>("/api/app-config"),
  },

  googleAuthUrl: `${PROD_URL}/api/auth/google`,
  googleRedirectBase: "https://edwai-prod-70474.web.app",
};

export default api;
