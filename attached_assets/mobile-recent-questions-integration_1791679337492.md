# EDUwAI Recent Questions — Mobile UI and API Handoff

Source-based handoff for the existing EDUwAI web implementation. All examples use fictional IDs and data. No web application, backend, database, or deployment changes are required.

## 1. Non-negotiable implementation boundary

**Build the mobile UI only. Reuse the existing EDUwAI backend and authenticated API client.**

The existing web-app backend is the shared system of record for web and mobile. It already stores recent questions, applies the **100-record limit per user and book**, automatically deletes older **unbookmarked** history entries when inserting new records beyond the cap, and enforces **50 bookmarks per user and book**.

Do not build another server, database, scheduler, retention job, custom-tag service, or history-write API. Do not implement the 100-record eviction algorithm in mobile storage. Mobile must read the server's history and request bookmark toggles; it must not independently decide which persisted records to delete.

| Responsibility | Existing backend | Mobile UI |
| --- | --- | --- |
| Persist questions after answers | Yes | No separate history write |
| Enforce 100 recent records | Yes | Display returned records |
| Automatically evict oldest unbookmarked records | Yes | No deletion job or pruning |
| Enforce 50 bookmarks | Yes | Display counts and server feedback |
| Scope data to signed-in user and book | Yes | Pass the selected book ID and valid authentication |
| Store bookmark status | Yes | Call toggle API and use returned boolean |
| Search current history | No separate search endpoint | Filter loaded question text locally |
| Expand/collapse, icons, labels, colors | No | Replicate web UI |
| Reuse a question | No special replay endpoint | Populate editor; submit only on a later explicit action |

The numbered history limits are not billing/question-generation quotas. Reusing a draft is not submitting a question.

## 2. What “tagging” actually means

The right-hand **tag icon** in the supplied screenshot is the control for a **boolean bookmark**, represented by `is_bookmarked`.

- Unbookmarked row: tag icon `🏷️`.
- Bookmarked row: bookmark icon `🔖`, amber row treatment, and a header bookmark-count badge.
- Tapping toggles the bookmark through the existing backend.
- Bookmarking moves the item into the bookmarked-first group.
- Removing a bookmark makes the record eligible for normal server-side eviction on later insertions.
- There are **no custom tag names, categories, colors, multiple tags per question, tag IDs, or tag CRUD endpoints** in this feature.

Do not interpret the tag icon as a request to implement a new tagging backend.

## 3. Configuration and state

These values are currently hardcoded in the inspected backend/frontend, not fetched from a Recent Questions settings API. The mobile UI can use matching display constants; the backend remains authoritative for enforcement.

| Setting | Existing value / behavior |
| --- | --- |
| History cap and GET limit | 100 records, scoped to user + document, including bookmarks |
| Bookmark cap | 50, scoped to user + document |
| Bookmark warning | Show when loaded bookmarked count is at least 40 |
| Search visibility | Show input when loaded history has more than 5 records |
| Search rule | Case-insensitive substring match against `question`, not answer preview |
| API ordering | Newest 100 first selected, then bookmarks grouped before unbookmarked items; descending creation time inside each group |
| Local reorder after toggle | Stable partition current list into bookmarked then unbookmarked; no new local timestamp |
| Header total | Loaded array length, not filtered result count |
| Bookmark badge | Show only when loaded bookmark count is greater than zero |
| Remaining count | `50 - loadedBookmarkCount` |
| Initial expansion | Collapsed; shared-book and personal-book panels have separate state |
| Empty history | Panel is not displayed |
| Empty search results | Show “No matching questions” |
| Search placeholder | “Search questions...” |
| List viewport on web | Maximum height 192 px; vertical scrolling |
| Bookmark cap label | “Bookmark limit reached (50/50)” |
| Near-cap label | “Only N bookmark(s) left”, with singular/plural matching N |

There is no history pagination, cursor, offset, configurable limit parameter, server-side search parameter, or history-settings endpoint on these routes. Do not invent them.

## 4. Two namespaces: shared books and personal resources

| Category | Shared textbooks / institution books — Phase 1 | Personal PDFs / YouTube — Phase 2 |
| --- | --- | --- |
| Book identifier | `Document.id` | `Phase2Document.id` |
| History identifier | `UserQueryHistory.id` | `Phase2QueryHistory.id` |
| History API | `/api/query-history/{document_id}` | `/api/phase2/documents/{document_id}/query-history` |
| Bookmark API | `/api/query-history/{history_id}/bookmark` | `/api/phase2/history/{history_id}/bookmark` |
| History storage | `user_query_history` | `phase2_query_history` |
| History sources field | Present | Not returned / not in this history table |
| Left row icon | `retrieve`: book `📖`; other mode: bulb `💡` | YouTube: movie `🎬`; otherwise PDF `📄` |

A document ID identifies a book, while a history ID identifies a row. **Never substitute one for the other.** The phases have independent ID spaces; identical numeric IDs do not mean the same book or question.

Use the mobile app's existing authorized book selection. Existing list APIs are:

- `GET /api/documents`: optional `board_id`, `class_id`, `medium_id`, and `subject` filters. The web calls it with selected class and subject. The backend applies processed-book, profile, and organization visibility rules. Records include an `id`, `title`, and education metadata.
- `GET /api/phase2/documents`: the signed-in user's personal resources, newest first. Records include `id`, `title`, `book_type`, `source_type`, `youtube_url`, `file_size_bytes`, `page_count`, `processing_status`, `processing_progress`, `is_ready`, `created_at`, and `last_queried_at`.
- `GET /api/phase2/documents/{document_id}`: existing personal-document status/detail lookup.

Use the ID from the correct list. Do not query histories using arbitrary IDs discovered outside the user's authorized book picker.

## 5. Authentication and base URL

Reuse the mobile application's **existing EDUwAI API origin and login/token refresh flow**. Examples use `<API_ORIGIN>` as a placeholder for that configured origin, with `/api` included once in the path.

All four history/bookmark routes require an access token:

```http
Authorization: Bearer <EXISTING_ACCESS_TOKEN>
Accept: application/json
```

The backend resolves the user from the token. Do not send `user_id`, credentials, or database connection information. Do not introduce new authentication or ask the user to sign in separately for history.

The web Axios client uses the configured API base, adds a bearer token, and uses its existing refresh flow; it also supplies organization-subdomain context where applicable. Mobile should reuse its established organization context rather than derive an organization from a development hostname.

Expired/invalid credentials: use the existing refresh/re-login behavior and then retry a safe GET. Do not blindly replay a bookmark toggle after an ambiguous network failure: it may already have succeeded and a second POST would reverse it.

## 6. History API contracts

### Shared-book history

```http
GET <API_ORIGIN>/api/query-history/42
Authorization: Bearer <EXISTING_ACCESS_TOKEN>
```

Successful response is a **bare array**, not a wrapper with `items`:

```json
[
  {
    "id": 701,
    "question": "Explain the difference between reflection and refraction of light rays?",
    "mode": "retrieve",
    "answer_preview": "Reflection is the return of light into the same medium...",
    "sources": [8, 9],
    "is_bookmarked": true,
    "created_at": "2026-10-10T12:30:00"
  }
]
```

### Personal-book / video history

```http
GET <API_ORIGIN>/api/phase2/documents/104/query-history
Authorization: Bearer <EXISTING_ACCESS_TOKEN>
```

```json
[
  {
    "id": 1501,
    "question": "What happens when light enters water?",
    "mode": "explain",
    "answer_preview": "The direction of light can change as it passes between media...",
    "is_bookmarked": false,
    "created_at": "2026-10-10T12:31:00"
  }
]
```

| Field | Type | Meaning / handling |
| --- | --- | --- |
| `id` | integer | History row ID used for bookmark POST |
| `question` | string | Original stored question text; preserve notation and Unicode |
| `mode` | string or null for older records | Saved answer mode; not the keyboard/input mode |
| `answer_preview` | string, potentially null in legacy data | Short preview, not a full saved-answer retrieval contract |
| `sources` | JSON page list, potentially null | Phase 1 only; derived page values can include nulls; not full citation objects |
| `is_bookmarked` | boolean | Backend's saved bookmark status |
| `created_at` | ISO timestamp string or null | Existing UTC convention; current code uses naive `datetime.utcnow()` and `isoformat()`, so examples have no `Z` suffix |

An empty array is valid. There is no document ID in each history row; retain the phase and document context from the request.

The shared-book handler checks document existence and filters history by current user and document. It does not independently reproduce the book list's organization-visibility checks. The personal handler additionally verifies document ownership. Do not describe both handlers as having identical access checks.

## 7. Bookmark API contracts

### Shared-book bookmark toggle

```http
POST <API_ORIGIN>/api/query-history/701/bookmark
Authorization: Bearer <EXISTING_ACCESS_TOKEN>
```

### Personal-book bookmark toggle

```http
POST <API_ORIGIN>/api/phase2/history/1501/bookmark
Authorization: Bearer <EXISTING_ACCESS_TOKEN>
```

No JSON body is required. Do not send a desired boolean; these are **toggle endpoints**, not “set bookmark” endpoints.

Both return:

```json
{
  "id": 701,
  "is_bookmarked": true
}
```

The `id` above is illustrative; the personal route returns its own requested history ID.

Apply the returned status to the matching row, then group bookmarked rows before unbookmarked rows. Stop event propagation so tapping the tag does not select the question.

The backend checks row ownership and counts bookmarks for that user and row's document. At 50, adding another bookmark fails; removing an existing bookmark is still allowed. The web gives an unbookmarked icon a not-allowed appearance at the cap but does not actually disable its button; the backend handles the rejection.

### Errors

| Route / condition | Status | Current detail |
| --- | --- | --- |
| GET history: missing document; personal document not owned | 404 | `Document not found` |
| Bookmark: missing row or row not owned | 404 | `History entry not found` |
| Bookmark: adding above cap | 409 | `Bookmark limit reached (50 per book)` |
| Invalid/expired access token | 401 | Existing authentication error; use existing auth flow |
| Non-integer path IDs | 422 | FastAPI validation details |
| Network/server failure | No response or 5xx | Not a success; preserve acknowledged state and offer retry/refetch |

Error responses normally use `{"detail": ...}`. The web's 409 alert says: “You've reached the 50 bookmark limit for this book.” Other bookmark failures are not surfaced by this handler; history-load failures are only logged. These are existing web limitations, not evidence of a successful write.

For mobile, an in-flight flag per row prevents accidental repeated taps. If a POST response is lost, refetch history to reconcile status rather than blindly toggling again. This is UI/request handling, not a new backend requirement.

## 8. Server storage and automatic deletion

### Shared-book history table: `user_query_history`

- `id`: integer primary key.
- `user_id`: required integer foreign key to `users.id`, indexed, declared `ON DELETE CASCADE`.
- `document_id`: required integer foreign key to `documents.id`, indexed, declared `ON DELETE CASCADE`.
- `question_text`: required text.
- `mode`: string length 20.
- `answer_preview`: string length 300; current save helper stores the first **250** answer characters without adding an ellipsis.
- `sources`: JSON; extracted page numbers/values, not stored full source objects.
- `is_bookmarked`: required boolean, default/server default false.
- `created_at`: datetime, default UTC.
- Composite index on `(user_id, document_id, created_at)`.

### Personal history table: `phase2_query_history`

- Equivalent integer primary key and required indexed user/document foreign keys, with declared cascading deletion.
- Parent document table is `phase2_documents`.
- `question_text`: required text.
- `mode`: nullable string length 20.
- `answer_preview`: nullable string length 300; text over 300 characters becomes first **297** characters plus `...`; otherwise unchanged.
- `is_bookmarked`: required boolean, default/server default false.
- `created_at`: datetime, default UTC.
- Composite index on `(user_id, document_id, created_at)`.
- No `sources` column in this recent-history model.

History is relational backend data, not an image/PDF in object storage, not a vector index, and not browser-local storage. PDF/media storage and full query audit records are separate features. The mobile app does not need database credentials or GCS storage APIs for Recent Questions.

### Retention algorithm — backend already owns it

On saving a new distinct history record:

1. Insert the record for the authenticated user and selected document.
2. Count that user's history records for that document.
3. If the count exceeds 100, select the oldest **unbookmarked** records, limited to the excess count.
4. Delete those records and commit.

This is insertion-triggered cleanup, not a daily scheduler or age-based TTL. The 100 cap includes bookmarked records; it is not “100 recent plus 50 bookmarks.” Bookmarks are preserved during normal eviction. Unbookmarking alone does not immediately delete the row.

History GET returns at most the newest 100 records and does not run cleanup. Under ordinary sequential writes and the existing 50-bookmark cap, insertion cleanup retains up to 100. The code does not expose a transactional concurrency guarantee or a live retention-settings endpoint; mobile must not invent one.

The schemas declare history cascading deletion with parent users/documents. Personal document deletion uses the existing backend deletion flow. Mobile must not add a separate history-cleanup API or retention process. No individual history-edit/delete or bulk-clear route is provided by this feature.

### Duplicate-handling differences

| Behavior | Shared books | Personal resources |
| --- | --- | --- |
| Duplicate lookup | Exact stored text versus `question.strip()` | Exact stored text versus `question.strip()` |
| New stored question | Incoming question unchanged | Trimmed question |
| When duplicate found | Return without changing timestamp, mode, or preview | Update timestamp, mode, and preview; keep ID and bookmark |
| Duplicate moves to most recent | No | Yes, on next fetch because timestamp changes |
| Case/notation normalization | None beyond lookup trimming | None beyond trimming |

The web trims query text at submission, so normal web submissions generally avoid the shared-book raw-storage versus trimmed-lookup mismatch. Do not redesign mobile draft text normalization; reuse the existing submission boundary.

Old comments mentioning 25 or 20 retained entries are stale: executable save/GET logic uses **100**. Do not copy those comments as configuration.

## 9. How records are created — reuse existing question APIs

Mobile does not call an “insert history” endpoint. Successful answers from the existing query APIs invoke the backend history helpers.

| Flow | Existing POST route | Request JSON |
| --- | --- | --- |
| Shared book, normal answer | `/api/query` | `document_id`, `question`, `mode`; optional `top_k` |
| Shared book, streaming | `/api/query/stream` | Same shared-book query fields |
| Personal resource, normal answer | `/api/phase2/documents/{document_id}/query` | `question`, `mode` |
| Personal resource, streaming | `/api/phase2/documents/{document_id}/query/stream` | Same personal query fields |

```json
{
  "document_id": 42,
  "question": "Explain the difference between reflection and refraction of light rays?",
  "mode": "retrieve"
}
```

For personal resources, omit `document_id` from the JSON; it is in the URL. Both request models default `mode` to `retrieve`. The existing UI distinguishes `retrieve` from explanatory modes; the history API returns the saved string rather than a new mode configuration.

Reuse the mobile application's already implemented answer/query client. These routes can incur existing question quota usage; **history loading and bookmarking do not themselves submit another answer query**.

Shared-book history writes also occur in shared-cache and teacher-curated answer branches. Personal non-streaming and streaming answers save recent history. Backend history-write exceptions can be caught/logged, so a successful answer does not provide a separate guaranteed “history committed” acknowledgment.

**Streaming timing:** the inspected shared and personal streaming paths can emit the `done` event before completing history persistence. A GET immediately on `done` can briefly return the old list. Refresh at stream completion/closure, and reconcile with a bounded additional GET when needed. Do not create a mobile history entry locally as a substitute for a server write, and do not resubmit the question to fix history.

For query-specific errors such as quota exceeded or a personal document not ready, retain the mobile app's existing query error handling. No changes to transcription, query generation, retrieval, or quotas are needed for this feature.

## 10. Web lifecycle and mobile parity

### Loading and refreshing

- Shared-book panel: fetch history when the selected shared document changes while using shared books; clear the shared list when there is no active shared document.
- Personal-resource panel: on selected personal document ID change, clear editor/answer-related display, collapse personal history, clear personal search, and fetch that document's history or clear it when deselected.
- After receiving an answer's streaming `done`, the web fetches the matching phase's history.
- Shared-book streaming also fetches after its read loop completes.
- Non-streaming fallback refreshes shared-book history; the inspected fallback does **not** explicitly refresh personal history. This is a parity caveat, not a request to change the web backend.
- Bookmark responses update the loaded list locally without a GET in the normal acknowledged path.
- There is no push subscription, periodic history poll, or automatic cross-device synchronization channel in this panel. Refetch retrieves shared backend state.

Mobile should key UI data/request context by `(signed-in user, phase, document ID)` and ignore responses for a book/account no longer selected. Clear account-scoped history when signing out. These are mobile UI safeguards, not another persistence layer.

### Selecting a recent question

The web row handler:

1. Invalidates/cancels pending voice-transcription work.
2. Copies `history.question` into the question editor.
3. Sets voice-preview-ready and voice-editing flags to false.
4. Collapses the matching history panel.
5. Clears that panel's search text.

It **does not** restore `history.mode`, auto-submit the question, retrieve a full old answer, or replace the currently displayed answer in this row handler. Let the user edit the question and choose an existing answer action normally.

### Filtering and bookmark sorting

Search only the already loaded history array:

```text
include row if search is empty
or lowerCase(row.question) contains lowerCase(search)
```

Search does not change the header total or bookmark counts. After an acknowledged toggle, replace the matching row's `is_bookmarked` with the response value and stable-partition the current list into bookmarked/unbookmarked groups.

The local reorder does not re-sort each group by timestamp; a later GET restores the backend's descending-time ordering. Mobile should distinguish this current web behavior from a claim that every local reorder is globally timestamp-sorted.

## 11. UI appearance and notation

The provided screenshot shows the light-theme expanded panel above the question editor. The source is authoritative for conditions and interactions.

| Element | Web geometry / type |
| --- | --- |
| Outer panel | 12 px corner radius; 2 px border; 16 px bottom margin |
| Header | Full width; horizontal flex; padding 16 px horizontally / 10 px vertically; 14 px text; weight 600 |
| Header content | Clock icon, `Recent Questions (N)`, optional bookmark-count badge; chevron rotates 180 degrees when expanded |
| Expanded body | Top border; padding 16 px horizontally / 12 px bottom |
| Search | 14 px text; 8 px radius; 1 px border; padding 12 px horizontally / 6 px vertically |
| List | 192 px maximum height; scroll; 2 px inter-row spacing; 8 px top margin |
| Row | 8 px radius; flex; 4 px gap; 14 px text |
| Question target | Flexible width; left-aligned; padding 12 px horizontally / 8 px vertically |
| Mode/source icon | 12 px; no shrinking; 8 px gap before text |
| Bookmark target | Non-shrinking; padding 8 px; separate tap handler |

### Theme color tokens

| Usage | Light | Dark / web “primary” theme |
| --- | --- | --- |
| Panel border | Indigo 200 `#c7d2fe` | Indigo 500 `#6366f1`, 40% opacity |
| Panel background | Indigo 50 `#eef2ff` | Indigo 950 `#1e1b4b`, 50% opacity |
| Header text | Indigo 700 `#4338ca` | Indigo 300 `#a5b4fc` |
| Header hover text | Indigo 900 `#312e81` | Indigo 100 `#e0e7ff` |
| Body separator | Indigo 200 | Indigo 500, 20% opacity |
| Question text | Indigo 800 `#3730a3` | Indigo 200 |
| Question hover text | Indigo 900 | Indigo 50 |
| Row hover | Indigo 100 | Indigo 500, 25% opacity |
| Bookmarked row | Amber 50 `#fffbeb` | Amber 500 `#f59e0b`, 10% opacity |
| Bookmarked icon | Amber 400 `#fbbf24` | Same; hover Amber 300 `#fcd34d` |
| Unbookmarked icon | Indigo 300 | Indigo 600 `#4f46e5`; hover Amber 400 |
| Bookmark badge | Amber 100 `#fef3c7` / Amber 700 `#b45309` text | Amber 500, 20% opacity / Amber 300 text |
| Warning | Amber 50 / Amber 700 | Amber 500, 15% opacity / Amber 300 |
| Search background | White | Indigo 900, 40% opacity |
| Search border | Indigo 200 | Indigo 500, 30% opacity |
| Search text | Indigo 900 | Indigo 100 |
| Search placeholder | Indigo 300 | Indigo 400 `#818cf8` |
| Search focus ring | Indigo 400 | Indigo 400 |

Do not depend on hover-only messaging on touch devices. Use existing native components and rendering support; no new backend or mandatory library replacement is implied.

Question labels use the web's compact `StemMarkdownRenderer`: Markdown/GFM, math support, KaTeX/mhchem, preservation of Unicode, conversion of `\(...\)` and `\[...\]` delimiters for rendering, and a raw-text fallback if notation cannot be formatted. Use the mobile app's existing STEM/Markdown renderer, with compact wrapping rather than showing raw commands or assuming all questions are English/plain text. This renderer conversion is presentation-only; do not overwrite the canonical stored question.

## 12. Mobile implementation checklist

- Use the existing authenticated API client; no new backend, DB, history-write route, or deletion job.
- Load the correct phase's history for the selected book ID.
- Display a collapsed panel only for non-empty history; support expansion and bounded scrolling.
- Preserve mode/source icons, bookmark treatment, total count, and search threshold.
- Render mathematical notation and multilingual question text through the existing mobile renderer.
- Keep row selection separate from bookmark toggling.
- On question selection, populate the editor only; do not generate or fetch an answer automatically.
- Treat server bookmark responses and 409 errors as authoritative; keep removal available at the cap.
- Let the server apply the 100-record limit and evict older unbookmarked entries.
- Refresh after answer completion; account for streaming persistence timing without another answer submission.
- Use account/phase/book-scoped UI state and reconcile ambiguous toggle failures with GET.

### Acceptance scenarios

1. Shared-book history and personal-resource history load from different route families and never mix.
2. Empty history hides the panel; six records show search; search changes rows but not the total.
3. Bookmark/unbookmark uses the history ID, applies the returned boolean, and changes the icon/group.
4. At 50 bookmarks, the server rejects a new one with 409, but unbookmarking still works.
5. Selecting a question fills the editor, cancels stale voice work, collapses history, and sends no answer request.
6. After the backend stores the 101st distinct question, the next GET reflects server eviction of an old unbookmarked record; mobile performs no deletion.
7. Repeating a question has the phase-specific duplicate behavior described above.
8. Switching books/accounts while a request is pending does not display the wrong history.
9. Stream completion followed by history refresh does not fabricate a record before the backend returns it.

## 13. Source references and verification scope

Source references for the inspected workspace; line positions may change in future revisions:

- `src-frontend/pages/StudentPortal.jsx:293-302,528-592,1224-1242,1348-1368,1424-1435,1568-1600,3349-3537`: state, routes, query completion, selection, search, bookmarks, and panel UI.
- `src-frontend/services/api.js`: configured API client, bearer-token injection, organization context, and authentication retry behavior.
- `src-frontend/config.js`: existing API base selection; reuse the mobile app's configured production origin.
- `src-frontend/components/StemMarkdownRenderer.jsx`: compact question renderer and notation fallback.
- `src-frontend/index.css:255-263`: compact paragraph/minimum-width rules.
- `main.py:2947-2952,4668-4748,5032-5076,7597-7656`: shared-book query model, book list, retention/dedup helper, history GET and bookmark POST.
- `main.py`: normal/streaming query history writes, including cached and teacher-curated answers.
- `database.py:711-726`: shared-book history schema and index.
- `auth.py:328-346`: authenticated user resolution.
- `phase2/routes.py:43-90,94-137,170-197,818-879,882-932`: personal query models, history save helper, book list, history/bookmark APIs, and existing document deletion.
- `phase2/routes.py:768-814`: streaming `done` and subsequent persistence sequence.
- `phase2/models.py:100-118`: personal-history schema and index.
- `tailwind.config.js`: current frontend styling setup.

This handoff is extracted from source, not from live production user records. No live history was exported, no questions/bookmarks were written, and no authenticated mobile/device session was exercised to generate this document. Sample responses illustrate the contract; they are not production API captures.
