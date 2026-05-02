# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Mobile App (EdwAI — artifacts/mobile)

Expo React Native app (iOS + Android + Web).

### Theme System
- `context/theme.tsx` — `ThemeProvider` + `useTheme()` hook
  - `mode: "primary"` = dark (default), `mode: "secondary"` = light
  - Persisted to AsyncStorage under key `"theme-storage"`
- Root layout wraps with `<ThemeProvider>`
- Tab bar (`(tabs)/_layout.tsx`) responds to `isDark`
- `HomeBanner` (index.tsx): conditional purple gradients, dot-grid (opacity 0.07),
  glow orbs, ☀️/🌙 theme toggle button
- `TextbooksScreen` and `ProfileScreen`: LinearGradient root, inline card overrides
- `DarkPicker`: themed bg/text/border via inline style overrides

### Key Files
- `app/(tabs)/index.tsx` — Textbooks tab (HomeBanner + TextbooksScreen)
- `app/(tabs)/profile.tsx` — Profile tab
- `context/theme.tsx` — theme context
- `constants/colors.ts` — design tokens (dark* and gray* keys)
- `services/api.ts` — API client with dynamic proxy URL

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   └── api-server/         # Express API server
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /health` (full path: `/api/health`)
- Depends on: `@workspace/db`, `@workspace/api-zod`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)
- Build bundles an allowlist of deps (express, cors, pg, drizzle-orm, zod, etc.) and externalizes the rest

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- `src/schema/<modelname>.ts` — table definitions with `drizzle-zod` insert schemas (no models definitions exist right now)
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)
- Exports: `.` (pool, db, schema), `./schema` (schema only)

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec (e.g. `HealthCheckResponse`). Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec (e.g. `useHealthCheck`, `healthCheck`).

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.

### `artifacts/mobile` (`@workspace/mobile`)

EdwAI mobile app built with Expo React Native (expo-router). Full Study Screen implemented with real API calls, SSE streaming, markdown, and flashcards. Play Store/App Store compliant (no payment buttons).

**Auth flow:** Login → OTP → Complete Profile → Textbooks tab (or Own Books tab if "Use Own Books" path taken)
**Auth state:** AsyncStorage via `context/auth.tsx` (keys: `edwai_access_token`, `edwai_refresh_token`, `edwai_user_v2`, `edwai_profile_complete`)
**Production API:** `https://edwai-api-953672603784.asia-south1.run.app` (proxied via api-server on web)

**Screens:**
- `app/index.tsx` — Login: Phone OTP / Email OTP / Google OAuth (edwai:// deep link)
- `app/otp.tsx` — OTP verification: 6-digit boxes, auto-advance, resend timer
- `app/complete-profile.tsx` — Profile: name, State→Board→Class cascading pickers. "Get Started" → textbooks tab; "Use Own Books" → own books tab
- `app/(tabs)/index.tsx` — **Phase 1 Textbooks**: board status check, restricted processing UI, Class→Subject→Textbook pickers (real API), SSE streaming Q&A, Answer from Book / Learn Concept modes, recent questions, image OCR upload, answer markdown display with sources/citation images/diagrams, image zoom modal, 3D-flip flashcards
- `app/(tabs)/my-docs.tsx` — **Phase 2 Own Books**: PDF upload (expo-document-picker), YouTube URL add, document list with 3-second polling for processing status, delete confirmation modal, full Q&A interface with SSE streaming, citation images, 3D-flip flashcards
- `app/(tabs)/history.tsx` — hidden tab (href: null)
- `app/(tabs)/profile.tsx` — Avatar, plan/usage display, settings, logout

**Shared study components** (`components/study/`):
- `AnswerCard.tsx` — streaming + final answer with markdown, sources pills, citation images, diagram grid, image zoom modal, validation badge
- `FlashcardsSection.tsx` — 3D-flip cards (react-native-reanimated Animated), type-colored gradients, prev/next/dots navigation

**API service** (`services/api.ts`):
- All endpoints typed: auth, data, study (board status/processing, classes, documents, SSE query, OCR, flashcards), phase2 (list/upload/youtube/delete, SSE query)
- `streamQuery()` — fetch + ReadableStream SSE parser; format: `data: {"chunk":"..."}` → `data: [DONE]`

**Key packages:** `react-native-markdown-display`, `expo-document-picker@~14.0.8`, `expo-image-picker`, `expo-linear-gradient`, `react-native-reanimated`
**Design system:** dark `#1a1a2e → #16213e` bg, primary `#667eea`, accent `#a78bfa`
**Tab bar:** NativeTabs (Liquid Glass iOS 26+), expo-blur BlurView fallback, plain dark on Android
Bundle ID: `com.edwai.app` | Scheme: `edwai`
