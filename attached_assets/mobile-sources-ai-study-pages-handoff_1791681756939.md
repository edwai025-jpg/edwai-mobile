# EDUwAI Sources & AI Study Pages — Mobile Handoff

Documentation-only extraction of the existing web pathway. Scope: **Sources notice, AI Study Pages notice/settings, existing image selection and retrieval, backend processing, and page footer**. Previously exported answer controls and Recent Questions are not reimplemented or re-exported.

## 1. Required boundary

**Mobile recreates the UI and uses the existing web-app backend pathway. Nothing new is implemented on the backend, and mobile does not generate, rank, regenerate, transform, or independently retrieve textbook pages.**

- Use existing authenticated EDUwAI APIs and the existing question/answer client.
- Keep generation, relevance selection, storage, publication/version fencing, and configuration in the current backend.
- In `edwai_generated` mode, display **AI-generated study pages only**. Never replace a missing generated image with an original textbook scan, PDF screenshot, or extracted textbook diagram.
- Do not download a PDF, perform local OCR, search storage buckets, derive a page from a printed page number, or generate a new infographic in mobile.
- Do not introduce another image endpoint, backend, database, provider integration, scheduler, or client-side page-ranking algorithm.
- This export contains **no actual study-page or textbook images**, including the image visible in the supplied screenshot. Example IDs and payloads below are illustrative; image bytes are omitted.
- Other display modes are described only to explain existing branch boundaries; this is not a request to add an original-page viewer to mobile.

## 2. Sources: exact setting-to-screen pathway

### Backend setting and student API

The Sources text is a global `SystemSettings` value:

| Storage key | Student response field | Screen location |
| --- | --- | --- |
| `student_source_citation_text` | `source_citation_text` | Paragraph beneath “Sources” |
| `student_page_context_text` | `page_context_text` | Notice beneath “AI Study Pages” / existing citation-section heading |

Read:

```http
GET <API_ORIGIN>/api/disclaimer-messages
Authorization: Bearer <EXISTING_ACCESS_TOKEN>
Accept: application/json
```

`<API_ORIGIN>` means the mobile app's already configured EDUwAI origin. Include `/api` only once. Do not create another login flow or send a `user_id`.

The response is an object with `source_citation_text`, `page_context_text`, and `ai_warning_text`. The last field is used elsewhere in the answer UI and is outside this extraction.

Illustrative response using the notice wording supplied by the user:

```json
{
  "source_citation_text": "EDUwAI has curated the context using the context and syllabus and training the general content to provide as accurate and as specific information as possible for students to excel in exam preparation. Note : that if you are not able to find the accurate information , use Learn Concept Mode.",
  "page_context_text": "Please review all generated AI study pages carefully. The first image may not always reflect complete accuracy, as these pages often attempt to summarize the entire context. Most importantly, AI systems can generate incorrect information—always verify key details against your course materials, recommended sources, and teachers.",
  "ai_warning_text": "<existing answer warning; not part of this handoff>"
}
```

**The long wording is configurable, not the code's default and not a value captured from the production database. Mobile must show the API value, not hardcode this sample.** The heading “Sources” is a frontend literal, not part of the returned paragraph.

### Defaults and legacy handling

Both the admin GET and student GET use `_student_disclaimer_text`:

- Missing row or falsey stored value: return the current default.
- Stored value whose trimmed text equals the exact legacy string: return the current default, without rewriting the stored row.
- Otherwise return the stored value unchanged; the client does not normalize, shorten, translate, or append its own explanation.

| Field | Current executable default |
| --- | --- |
| `source_citation_text` | `EDUwAI generated this response using relevant learning context.` |
| `page_context_text` | `Related learning context is shown to support your study.` |

Exact legacy strings recognized by the backend:

- Sources: `EDUwAI Generated Content using related syllabus/context, the actual discussion may be in the following pages of official study material/text book.`
- Page context: `Please check the adjacent pages for full context as only top 3 pages are shown here for the reference`

Saving an empty string does not disable these notices; GET replaces it with the default. A whitespace-only custom value is truthy and is not replaced by this helper. Do not implement a separate legacy/default-selection algorithm in mobile.

### Existing admin configuration — reference only

- `GET /api/admin/disclaimer-messages`: returns the same three fields; admin authentication required.
- `POST /api/admin/disclaimer-messages`: accepts an object containing any of `source_citation_text`, `page_context_text`, `ai_warning_text`. Present keys are inserted/updated in `SystemSettings`; omitted keys are untouched; commits once.
- Success: `{"message":"Disclaimer messages updated successfully"}`.
- These are global settings, not per-book, per-user, or per-board notices.
- Student mobile calls the **student GET only**. Do not add a mobile admin editor or write these settings as part of displaying the notices.

### Web loading and display conditions

- Disclaimer state initially contains empty strings.
- `loadDisclaimerMessages()` runs on portal mount.
- On success, each value is assigned as `data.<field> || ''`.
- On failure, the web logs “Failed to load disclaimer messages”; initial notices remain empty. It does not substitute the screenshot's text locally.
- No push subscription, refresh timer, or per-answer disclaimer reload exists in this loader. Admin edits become visible on a subsequent settings fetch.
- Sources card appears only when `answer.sources?.length > 0`.
- Sources heading remains visible even if its notice is empty; the paragraph itself is conditional on a truthy `source_citation_text`.
- The card renders the generic notice, **not a list of source-page numbers, textbook scans, source snippets, or clickable per-source references**.
- The notice is plain text in JSX, not Markdown or HTML. “Learn Concept Mode” inside the setting is not an automatic mode switch or a hyperlink.

## 3. AI Study Pages: display setting and notice

### Board-controlled display mode

This is a different setting from the notice text:

```http
GET <API_ORIGIN>/api/boards/7/page-config
Authorization: Bearer <EXISTING_ACCESS_TOKEN>
```

```json
{
  "board_id": 7,
  "page_display_mode": "edwai_generated",
  "ncert_book_code": null
}
```

- Backend source: `Board.page_display_mode`.
- Known branches: `original`, **`edwai_generated`**, and `embedded`. Preserve the spelling `edwai_generated`; do not rename it to `eduwai_generated`.
- Missing/falsey mode defaults to `original`.
- Missing board returns 404, `{"detail":"Board not found"}`.
- Optional query parameter `document_id` returns that document's `ncert_book_code`; the normal web call does not pass it, so `ncert_book_code` is normally null in this fetch.
- The web fetch runs when `user?.board_id` becomes known/changes, not for every image. If no board ID exists, it does not call this loader.
- Web fetch failure stores `{page_display_mode:'original', ncert_book_code:null}`.
- The image-serving backend determines its own branch from the **document's** board, rather than accepting a client display-mode override. A mismatch between user-board config and document-board config can affect the frontend label; do not claim they are always the same or change the web implementation to resolve it.
- Existing board administration sets this field through `POST /api/admin/boards` or `PUT /api/admin/boards/{board_id}` along with the existing board fields. Mobile does not change board settings.

### Heading and notice

The shared-book image section is gated by:

```text
answer.sources?.[0]?.base64_images?.length > 0
```

- Config `edwai_generated`: palette icon and heading **“AI Study Pages”**.
- Other configs: book icon and existing heading “Page Citations”.
- Only the **first source object's** `base64_images` array is read for this shared-book section.
- If all generated-image requests fail or are omitted, the section and its page-context notice do not appear. Do not render placeholder textbook pages.
- The notice is conditional on truthy `page_context_text`.
- The web adds `ℹ️ ` before the API's plain text. It is not embedded into the image; the backend default itself does not include this icon.
- If an admin includes the icon in the stored string, the existing web markup would add another one; the guide does not silently change that behavior.

The Sources paragraph and AI Study Pages notice are independent fields. Do not substitute one for the other or use the unrelated `ai_warning_text` as the study-page notice.

## 4. Streaming retrieval: reproduce this exact web branch

The existing shared-book answer stream supplies the image-selection metadata. Mobile does **not** calculate it.

Relevant fields on the existing stream's `done` event:

| Field | Use |
| --- | --- |
| `document_id` | Current backend-resolved document identity for image requests |
| `image_source_pages` | Ordered physical PDF page IDs selected by the backend |
| `image_primary_pages` | Subset classified as direct matches |
| `sources` | Existing answer sources; first source receives fetched image presentation data |
| `is_visual_question` | Used by standard image POST branch for diagram inclusion |
| `answer_not_found` | Suppress image fetching/rendering for unsupported answers |
| `material_not_found`, `general_fallback` | Existing answer state; never invent related pages when the backend sends no eligible image pages |

Illustrative metadata only:

```json
{
  "type": "done",
  "document_id": 42,
  "image_source_pages": [18, 20],
  "image_primary_pages": [18],
  "answer_not_found": false
}
```

This is an excerpt, not a complete answer-event schema.

### Fetch gate

The web fetches images only when:

1. `answer_not_found` is false.
2. `image_source_pages` is non-empty.
3. The event has a `document_id`.
4. This is a shared-book answer, not `useOwnBook`.
5. The question/document request is still current.

It sets image-loading state and attaches the image requests to that answer's cancellation fence.

### Generated-only branch

For `edwai_generated`, the web:

1. Takes `image_source_pages.slice(0, 5)`. Current backend selection normally returns at most **3**, so five is a frontend bound, not a guarantee of five returned images.
2. Builds `page_${String(page).padStart(3,'0')}.png`.
3. Sends parallel authenticated binary GETs:

```http
GET <API_ORIGIN>/api/ai-images/42/page_018.png
Authorization: Bearer <EXISTING_ACCESS_TOKEN>
```

4. On HTTP success, reads the response Blob and converts it to a data URL for the web image element. Native mobile may use its existing image decoder/viewer for the same response bytes; this is rendering, not another processing pipeline.
5. Creates a presentation item containing `page`, `data`, `filename`, and `image_role`.
6. Sets `image_role` to `direct_match` if the physical page is in `image_primary_pages`; otherwise `nearby_context`.
7. Drops failed/non-success responses.
8. Sorts successful items with direct matches first, then preserves the original backend selection order within each role.
9. Applies `citation_images` to `answer.sources[0].base64_images` and explicitly applies `diagram_images: []`.
10. Ends loading after all requests settle, without discarding the answer text.

**Important:** failed results carry an internal flag named `needsFallback`, but this branch does **not** perform a fallback. It filters them out. Do not mistake the variable name for permission to call a PDF/image renderer or switch to `/api/images/...`.

The merge only attaches images if there is already a first source object. It does not manufacture a synthetic source for an empty `sources` array.

### Cancellation and stale responses

The web's `createAnswerRequestFence` tracks a request ID and document identity. Starting a new question, switching documents, or disposing aborts active query/image requests. `isCurrent()` is checked before applying image responses or clearing loading state.

Mobile must preserve that existing request-lifecycle behavior using its current client/UI components. Late images must not be attached to another question or another book. Do not create a second answer lifecycle or cache service for these pages.

On `answer_not_found`, the web removes `base64_images` from returned sources and suppresses diagrams. Generated display mode also suppresses cached `event.diagrams` through `diagramsForDisplayMode`. Neither unsupported answers nor generated-mode cache hits authorize original diagram display.

## 5. Binary AI-image API: exact backend behavior

```http
GET /api/ai-images/{document_id}/{filename}
```

- Requires the existing bearer token.
- Looks up `Document` by ID; absent document: 404, `Document not found`.
- For a private organization document, caller must have the same `org_id`; mismatch: 403, `Document not accessible`.
- Accepted filename regex: `^page_\d{3}(_ai)?\.png$`.
- Accepts `page_018.png` and legacy alias `page_018_ai.png`.
- Invalid filename: 400, `Invalid filename`.
- Removes `_ai` before deriving the storage identity.
- Extracts the three-digit physical page number; the handler's regex currently does not accept a four-digit page filename. Do not work around this by truncating page IDs.
- Reads `document.active_image_dispatch_id`.
- If `document.batch_dispatch_id` exists but no active image dispatch is published: 404, `AI image not published`. It does not serve an older stable image.
- Resolves the key through existing `storage.get_ai_page_image_path`.
- Downloads the stored bytes and returns them unchanged as **`Content-Type: image/png`**, not JSON.
- Storage/download failure: 404, `AI image not found`.
- No request body, pagination, prompt, model selector, desired mode, source URL, or mobile-specific processing parameter.
- This handler does not add a page footer or run generation when an image is missing.

Internal paths, documented for understanding only:

```text
Immediate / legacy:
phase1/ai_images/doc_{document_id}/page_{page:03d}.png

Published versioned delayed attempt:
phase1/ai_images/doc_{document_id}/dispatches/{active_image_dispatch_id}/page_{page:03d}.png
```

These are backend storage keys, not public URLs. Mobile must not construct bucket URLs, list objects, use storage credentials, or choose a dispatch itself. The backend owns publication and selects the active attempt.

## 6. Standard image API and non-streaming boundary

The web's **original/embedded** streaming branch uses the existing standard POST; generated streaming uses the binary GET branch above instead.

```http
POST <API_ORIGIN>/api/query/images
Authorization: Bearer <EXISTING_ACCESS_TOKEN>
Content-Type: application/json
```

```json
{
  "document_id": 42,
  "pages": [18, 20],
  "primary_pages": [18],
  "include_diagrams": false
}
```

Request contract:

- `document_id`: required integer.
- `pages`: required integer array of physical PDF pages.
- `primary_pages`: integer array, default `[]`.
- `include_diagrams`: boolean, default `true`; web supplies `event.is_visual_question || false`.
- Server uses only the first **3** requested pages.
- Backend resolves the document's board mode; there is no client mode override.
- Same document existence and organization checks as binary GET.

Illustrative generated-mode response, with image data deliberately omitted:

```json
{
  "diagram_images": [],
  "citation_images": [
    {
      "filename": "page_018_ai.png",
      "data": "data:image/png;base64,<IMAGE_BYTES_OMITTED>",
      "page": 18,
      "pdf_page": 18,
      "image_role": "direct_match"
    }
  ],
  "image_fetch_errors": [],
  "page_display_mode": "edwai_generated"
}
```

Generated behavior inside this endpoint:

- Uses the same active-dispatch storage resolver.
- Skips unpublished/missing generated images.
- Does not load extracted textbook diagrams, even when `include_diagrams:true`.
- Does not fall back to original scans.

Other existing branches, **not new mobile features**:

- `original`: backend tries existing PNG/JPEG full-page storage variants; extracted diagrams are separate. This is not an allowed substitute for generated-only mode.
- `embedded`: backend uses the document's `ncert_book_code` and `enable_source_embedding` to return `ncert_url` items with `data:null`. Existing backend can fall back to original mode if that setup is missing or URL construction fails. This behavior belongs to the embedded branch, not the generated branch.

Standard endpoint deduplication is backend-only: 8×8 average image hash, Hamming distance at most 5 treated as duplicate, keeping the first; hashing failure retains the item. Diagram output is capped at 3. Non-embedded citation images are deduplicated and sorted direct-match first, then ascending page number. Embedded URLs are not image-deduplicated.

`image_fetch_errors` contains at most 5 diagnostics only when errors occurred and **both** image arrays are empty; partial success returns an empty error list. The frontend logs diagnostics, silently handles image failures, and retains the answered text. Do not turn a missing image into a repeat answer request.

### Existing non-streaming answers

The existing `/api/query` pathway can return image presentation data already attached by backend `load_citation_diagram_images_for_pages`. Cached and teacher-curated branches also preserve the established display selection/serving rules. Mobile must consume the existing response rather than introduce another page-generation call.

The non-streaming helper resolves generated-only mode, active publication, and physical page IDs on the backend. Missing AI images are omitted; it does not substitute originals in generated mode.

The fresh-answer path may relabel a returned image's `page` to its printed-page label after loading, while retaining `pdf_page` as physical identity. **Use backend-provided `image_source_pages` / `pdf_page` for image lookup, not the printed `page` label.** A page-footer label does not require displaying either number.

Personal-resource `citation_images` use a separate existing format/section labelled “Page Citations”. The shared-board AI Study Pages fetch is not added to personal PDFs or videos by this handoff.

## 7. How pages are processed — existing backend only

These pages are pre-generated educational artifacts from book processing, **not fresh images generated for each student question**.

### Content and image generation

The existing Phase 1 processing pipeline:

1. Extracts page-local text and educational context through existing OCR/document processing.
2. Supplies the page text, optional diagram labels, subject, grade/class, and instruction medium to the existing generator.
3. Builds a subject/page-type-aware prompt from the page's facts, definitions, and examples.
4. Uses the existing full-color portrait study-guide styles (3:4 aspect requested in the prompt), including concept zones, a topic banner, original illustrations, labels, arrows, and examples as appropriate.
5. Calls the server-controlled generation provider.
6. Saves the resulting bytes through existing `upload_ai_page_image`; there is no footer-stamping step in this writer.

The generation entry point rejects text shorter than 20 stripped characters. The metadata/content eligibility helper separately requires at least 30 stripped characters and three Unicode alphabetic word tokens. These are distinct checks, not one universal “minimum text length” mobile should implement.

The prompt prohibits publisher names/logos, book/chapter headers and footers, page/copyright/section/figure numbering, textbook scans/layouts, and copying/tracing/cropping/overlaying source artwork. Diagrams must be freshly AI-generated representations of the educational concept. Original PDFs/OCR stay in their existing backend retrieval system; they do not become generated infographic pixels.

Immediate processing already has provider/quota retry handling and prompt escalation levels `0 → 1 → 2` for no-image/refusal cases. The inspected sequential path has up to 8 quota retry waits `[5,15,30,60,60,60,60,60]` seconds and a 3-second gap for no-image escalation. These are server ingestion details, not mobile request retries or background jobs.

Delayed processing stores output within the current dispatch's versioned namespace. The existing backend fences stale attempts before writing/publishing; mobile never selects or publishes a dispatch. Missing assets are handled by the existing backend operational workflow, not by regenerating them from a student device.

### Model/background settings

These are distinct from board display mode and student notices:

| Existing setting | Responsibility |
| --- | --- |
| `image_gen_model` | Generation model ID |
| `image_gen_region` | Generation region override |
| `image_gen_auth_mode` | Existing `api_key` or `vertex_ai` server transport |
| `image_gen_model_notes` | Admin-facing model notes; not a Sources notice, image footer, or study-page disclaimer |

Existing admin APIs: `GET` and `PUT /api/admin/settings/image-gen-model`. GET returns `model`, `region`, `auth_mode`, `notes`. PUT requires `model`; `region`, `auth_mode`, and `notes` are optional. These are admin-only and **must not be called by mobile to display pages**.

The image-generation model resolver uses cache/DB, then `GCP_IMAGE_GEN_MODEL`, then executable default `gemini-2.5-flash-image`; model DB cache refresh interval is 30 seconds. Region resolver uses its existing cache/environment path, otherwise `global` for Gemini and `us-central1` for Imagen. Auth resolver uses existing cache/DB/environment handling, default `vertex_ai`; Imagen forces Vertex.

GCP generation routes through the selected existing transport. Non-GCP generation uses the established Gemini developer path. Mobile supplies neither credentials nor generation parameters and does not copy these transport choices into a separate service.

### Generated-page presentation metadata

After a page's OCR checkpoint succeeds, the sequential processor makes a separate, best-effort `upsert_page_metadata` call. Its failure must not alter OCR, image submission, embeddings, status, answer retrieval, or original citation facts.

The backend deterministically derives metadata from the existing page text/context, with **no extra model/API call**:

- Topic (up to 300 characters), topic phrases, distinctive terms (up to 120), and math/formula terms.
- Subject category, instruction medium (up to 120 characters), chapter (up to 300), printed page number, and page type.
- Normalized searchable text (up to 20,000 characters), SHA-256 content hash, and `image_eligible`.
- Current document ID, physical page number, and source dispatch identity. Immediate metadata uses `__immediate__`; delayed metadata uses its existing dispatch.

This is presentation metadata for newly processed documents, not a mobile search index or a new answer-retrieval store. No automatic old-book backfill is added by this handoff.

## 8. How the backend chooses relevant generated pages

Mobile consumes the selected page IDs; it must not reproduce this algorithm.

### Current-document metadata route

`select_image_source_pages` first calls `resolve_generated_page_selection`:

- Only runs its generated lookup when the current document's board is `edwai_generated`.
- Reads the **complete current document's metadata for the active dispatch**, not another book's cached page IDs.
- An unpublished current delayed attempt returns no pages.
- Skips ineligible/out-of-range rows.
- Requires a distinctive question-topic match or an exact multi-word topic phrase. Answer words can improve ranking but cannot make an unrelated page eligible by themselves.
- Uses exact/conservative word forms, not broad fuzzy matching. Formula-only matches need at least two matching formula terms before contributing to direct eligibility.
- Scores candidates as: phrase match `+8`; each direct term `+5`; direct-term intersection with question tokens `+1.5` each; answer overlap `+0.25` each capped at 8 overlaps; preferred/cached page hint `+0.2`.
- Deduplicates physical page identity, keeping its best score.
- Sorts descending score then ascending physical page, returns at most 3; qualifying selected pages are marked primary/direct.
- Metadata exists but no relevance match: return empty arrays, **not fallback to arbitrary pages**.
- Once generated mode is established, metadata lookup failure fails closed with empty arrays.

### Existing legacy selector

If the document has no generated metadata, the existing legacy selector remains:

- Uses retrieved page-local evidence, question, answer, preferred pages, and total-page bounds.
- Loads full page text for current-document candidate pages where available, ordered by page and chunk index; fallback evidence is existing retrieved text if that lookup fails.
- Applies existing topic/polarity safety and rejects opposite-only context where appropriate.
- Receives explicit backend limits `page_limit:3`, `primary_limit:3`. Do not copy the ranker's standalone default arguments as the active API limit.
- Physical PDF IDs are retrieval identities; printed page numbers are presentation labels.

Selection is strictly display-only. It does not rewrite answer text, sources/citation facts, embeddings, shared-cache metadata, query history, or the document's indexed syllabus. Cached/teacher answers still use the current document for generated image resolution; cached page IDs are hints, not cross-document image identities.

## 9. Page footer: exactly how it is added

**The footer is a native/web UI element beneath the image, not text burned into PNG bytes.**

For each shared-book citation item, the web renders:

```text
image_role == "direct_match"  →  "Best match"
any other/missing role        →  "Nearby context"
```

- Binary generated fetch derives the role from `image_primary_pages`.
- Standard backend image responses derive the role with `_image_role_for_page(page, primary_pages)`, using the same membership test; empty primary list means nearby context.
- The footer uses the item metadata, not image OCR, a model-generated label, or a saved footer setting.
- Outer strip: top border, 12 px horizontal / 8 px vertical padding, flex alignment and 8 px gap, base 14 px gray text.
- Label: 12 px, weight 600, uppercase transform, tracking-wide letter spacing (0.025em). Visually renders **BEST MATCH** or **NEARBY CONTEXT**.
- Direct match: Blue 700 label, Blue 300 image-card border.
- Other/missing role: Gray 500 label, Gray 200 image-card border.
- There is no book title, physical page number, printed page number, copyright line, publisher logo, user name, or `EDUwAI` watermark added by this footer component.
- There is no API call to save a footer and no backend footer-setting key for this strip.
- Server generation/storage/serving paths inspected here do not composite this label onto the PNG.
- A model-produced mark already within image bytes is part of the stored artifact, not this metadata footer.
- Tapping the image opens a viewer with the same `data` and type `citation`; the web zoom viewer shows the **image only**, not this external role-label strip.

The source notice and page-context notice are outside the image too. The answer area also has a separate hardcoded general AI-verification footnote; that is not a study-page image footer and is not re-extracted as another feature here.

## 10. UI configuration for the two requested sections

### Sources card

- Appears after the answer content when there are sources.
- 16 px padding, 12 px corner radius, 1 px border.
- Header: document icon at 18 px; “Sources”, weight 600; 8 px gap; 4 px bottom margin.
- Notice: 12 px italic text; 28 px left indent; 12 px bottom margin.
- Light: white card, Gray 200 border, Gray 900 heading, Gray 500 notice.
- Web primary/dark theme: `#1e1e2e` at 90% opacity, primary color border at 30% opacity, white heading, Gray 400 notice. Current primary token is `#667eea`.

### AI Study Pages card

- Render only for the first source's non-empty image presentation array.
- Outer: 24 px padding, 8 px radius, white background, Gray 200 border. This block stays light in the inspected web markup even under the primary/dark theme.
- Header: 24 px palette icon, 18 px bold Gray 900 title, 8 px gap, 16 px bottom margin.
- Notice: 12 px padding, 8 px radius, Blue 200 border, Blue 50 background, 16 px bottom margin; 14 px Blue 900 text, with info prefix.
- Pages: single-column vertical stack, 16 px spacing, 8 px card radius, clipped rounded corners, white background.
- Image: full available width, automatic height/aspect ratio; accessible alt text “Related study page”.
- Web hover: 1.05 scale; light black hover overlay and zoom icon. These are presentation affordances, not new images.
- Tap: existing image zoom/viewer; dismiss via close button or backdrop, not by fetching a second file.
- Web viewer: black 75% backdrop, z-index 50, 16 px outer padding, max width 1152 px, max height 90vh; white rounded scroll container. Clicking the image container does not dismiss it.
- Image-loading state: spinner and “Loading source images...”, separate from final page card. It ends without losing the answer if images fail.

Relevant palette: Gray 200 `#e5e7eb`, Gray 400 `#9ca3af`, Gray 500 `#6b7280`, Gray 600 `#4b5563`, Gray 900 `#111827`; Blue 50 `#eff6ff`, Blue 200 `#bfdbfe`, Blue 300 `#93c5fd`, Blue 700 `#1d4ed8`, Blue 900 `#1e3a8a`.

Use the mobile application's existing text, image, loading, and viewer components. Do not introduce a new graphics pipeline or UI dependency replacement as part of this extraction.

## 11. API/error quick reference

| Mobile call | Success | Important errors |
| --- | --- | --- |
| `GET /api/disclaimer-messages` | JSON notice settings | Existing auth/network/server failures |
| `GET /api/boards/{board_id}/page-config` | JSON board display configuration | 404 board missing |
| `GET /api/ai-images/{document_id}/{filename}` | PNG bytes | 400 invalid filename; 403 other organization; 404 document/image missing or unpublished |
| Existing `POST /api/query/images` | JSON image arrays/config/diagnostics | 403 other organization; 404 document missing; 422 invalid request shape |

Invalid/expired tokens use the existing authentication flow. Protected administrative APIs reject non-admin callers. Do not put provider keys, database/storage credentials, or access tokens into the export.

No mobile call is required for generation-model settings, image publication, footer creation, metadata derivation, regeneration, or changing notices.

## 12. Parity acceptance checklist

- Sources text and page-context text come from their separate backend settings.
- Sample/screenshot wording is not hardcoded as a substitute for API settings.
- Heading and retrieval branch use the existing board configuration.
- Generated streaming fetches the same authenticated `/api/ai-images/...` resources selected by the backend.
- A missing/unpublished generated image is omitted, never replaced by an original page or diagram.
- No mobile generation, OCR, page-selection algorithm, bucket access, or regeneration job exists.
- Physical page IDs are used for lookup; printed labels are never substituted for them.
- Direct-match ordering and role footer match the existing web behavior.
- The footer is UI text, not an image modification, and zoom opens the original returned bytes.
- An unsupported answer or a stale request never gains images from another question/book.
- Existing non-streaming responses are consumed without adding a new image-generation pathway.
- No actual source/study-page images are included in this handoff.

## 13. Source references and verification scope

Inspected current workspace; line positions can shift:

- `src-frontend/pages/StudentPortal.jsx:240-242,311-318,456-467,540-548,663-674`: theme, settings state, notice loading and board config.
- `src-frontend/pages/StudentPortal.jsx:1402-1550`: stream metadata, generated binary requests, merge/order, loading and cancellation checks.
- `src-frontend/pages/StudentPortal.jsx:3980-3995,4038-4130,4193-4223`: Sources card, shared study-page section, role footer, zoom viewer.
- `src-frontend/utils/answerRequestFence.js`: request cancellation, document identity and generated/unsupported diagram suppression.
- `main.py:9791-9906`: notice defaults, legacy handling, admin/student settings endpoints.
- `main.py:7461-7528`: board page-config and generated binary image serving.
- `main.py:7186-7190,7277-7459`: standard image request/response, board-mode branching, errors and sorting.
- `main.py:2201-2309,2312-2415,2419-2475`: display selection limits, role classification, image loading and deduplication.
- `main.py:6040-6076`: fresh non-streaming image loading and printed/physical identity distinction.
- `main.py:3420-3445,3498-3517,10199-10290`: existing administrative board/model configuration.
- `storage_service.py:264-312`: stable/versioned AI-image paths and unchanged-byte upload.
- `phase1_parallel/ai_image_generator.py`: original-artwork directives, content checks, prompt routing, model/region/auth resolvers, generation entry point.
- `phase1_parallel/sequential_processor.py:483-511,946-1005`: isolated metadata write, generation retry/upload path.
- `phase1_parallel/batch_image_gen.py:596-613`: delayed-attempt fenced image upload.
- `phase1_parallel/generated_page_metadata.py:106-218,234-379`: metadata derivation/persistence and document-local generated-page selection.
- `page_relevance.py:537 onward`: existing legacy display-page relevance/polarity selector.

Verification is against source and the exported document's rendering. This is not a production API capture or an authenticated-device test. No live student images, source PDFs, questions, admin settings, or bookmarks were fetched or changed to produce it.
