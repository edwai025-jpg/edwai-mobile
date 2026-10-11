# EDUwAI Academic Class Selection — Mobile Handoff

Source-based implementation handoff for the web class-default and academic class-switching behavior. The intended UI change is small; the existing class/document APIs and their access rules are not.

## Important: existing API limitation for switching grades

The web UI now defaults to the profile class when that class is in the available list, and it keeps all returned classes selectable. The class and subject endpoints can return processed classes/subjects across the student's board.

However, the existing `GET /api/documents` route also filters non-institute students to `current_user.class_id`, in addition to the requested `class_id`. As a result, selecting a different class can load that class's subjects but return no books from `/api/documents`. This means the complete “review material from another class on the same board” behavior is **not currently supported by the existing document-list API**.

Mobile must not work around this client-side by changing board IDs, querying another user's class, or calling a different/unverified endpoint. A backend access-rule change would be needed before cross-class book selection can fully work. No backend change is included in this handoff.

## Scope and ownership

- Recreate the class selector and defaulting behavior in the mobile UI.
- Reuse the signed-in student's existing profile (`class_id`) and the current authenticated EDUwAI API client.
- Treat `GET /api/student/available-classes` as the authoritative list of classes that have processed materials the student can access.
- Keep the existing backend responsible for board/org scoping, subject availability, document access, and processed status.
- This flow is for academic/Phase 1 content. It does not change Phase 2 personal uploads, YouTube mode, profile creation, or class assignment.
- Do not show the question interface until an academic source/document is selected.

## Web behavior to reproduce

### When the academic source selector is shown

The web renders **Select Your Source** in academic/textbook mode when board restrictions allow it:

```js
(!boardStatus?.is_restricted ||
  boardStatus?.processing_status === 'completed') &&
!useOwnBook
```

The selector contains three steps: **Class → Subject → Source**. The class selector stays available after its initial default so students can choose any other class returned by the available-classes API.

### Default class selection

The web waits for a non-empty available-classes list and for the student's `class_id` to be available from the authenticated user profile. It compares IDs as strings (so a numeric API ID matches a string profile ID).

```js
const profileClass = classes.find(
  item => String(item.id) === String(user.class_id)
);
```

- If the profile class is in the API response, select it.
- If a board student's profile class is not in the response, leave the selector unselected. Do **not** silently default to another grade.
- The choice is a one-time initial default. A deliberate student selection must not be replaced by a later defaulting effect.
- For institute students (identified by `org_role === 'student'` and `org_id`), preserve the existing organization-scoped behavior: prefer the assigned class if it is available; otherwise use the first class returned by the org-scoped list. The org-provided `class_name` is used for the assigned class's display name.
- A board student's list and an institute student's list must never be combined.

### Changing class

When a student chooses a class, the web immediately:

1. Stores the chosen class ID.
2. Clears the subject, available-subject list, book list, and selected book.
3. Loads subjects for the new class.

The user must not retain a subject or book from the previous class while the new class's options load.

### Subject and book selection

- If exactly one subject is returned, the web auto-selects it. If there are zero or multiple subjects, there is no automatic subject selection.
- When a class and subject are selected, the web requests matching documents.
- If exactly one document is returned, the web auto-selects it. With multiple documents, the student chooses a source.
- The Source selector is disabled when the current document list is empty.
- The academic **Ask Your Question** section appears only when a source document is selected (`document` is truthy). Choosing a class or subject by itself is not enough.

## Existing authenticated API sequence

Use the mobile app's existing API origin and bearer-token client. Do not create a new login flow or send a user ID.

### 1. Load accessible classes

```http
GET /api/student/available-classes
Authorization: Bearer <existing access token>
```

The response is an array of `{ "id": number, "name": string }`.

- Board student: distinct classes with processed public documents for the signed-in user's board (`Document.board_id == current_user.board_id`, `processed == true`, `org_id == null`).
- Institute student: distinct classes with processed documents for that student's organization.
- If the board student has no `board_id`, this endpoint returns an empty list.
- The endpoint accepts no client-provided board ID; scope is derived from the authenticated user.

Example only:

```json
[
  { "id": 9, "name": "Class 9" },
  { "id": 10, "name": "Class 10" },
  { "id": 11, "name": "Class 11" }
]
```

### 2. Load subjects for the selected class

```http
GET /api/student/available-subjects?class_id=9
Authorization: Bearer <existing access token>
```

Returns a JSON string array, for example:

```json
["Mathematics", "Science"]
```

The authenticated user's board (or institute) and processed-document status determine the accessible results. The selected `class_id` narrows the list. Do not pass a different board/org identity.

### 3. Load source books for the selected class and subject

```http
GET /api/documents?class_id=9&subject=Mathematics
Authorization: Bearer <existing access token>
```

The response is an array of processed document objects. The selector needs at least `id` and `title`; the API also returns related class/board/medium fields.

**Current limitation:** for non-institute users, this route additionally filters results to the profile's `current_user.class_id` (and profile medium when present). Therefore, requesting another class ID may return an empty document array even though that class appears in `/available-classes` and has subjects. Mobile should preserve the same access behavior and not try to bypass it.

## UI states and labels

| State | Expected UI |
| --- | --- |
| No available classes | Show the existing no-textbooks message for the student's board/org. |
| Classes are available but no class selected | Show “Select a class to see available subjects.” |
| Class selected, no subjects | Show “No subjects with textbooks available for this class yet.” |
| Multiple subjects, none selected | Show “Select a subject to see available textbooks.” |
| Class + subject selected, no documents | Show “No textbooks available for this combination yet.” |
| Source selected | Show the academic question interface. |

## Implementation checklist for mobile

- [ ] Load the available class list with the existing authenticated client.
- [ ] Wait for the profile's `class_id`; select it only if it appears in the returned list.
- [ ] Compare class IDs without assuming profile and API IDs have the same JSON type.
- [ ] For a board student whose profile class is unavailable, leave the class selector blank; do not silently choose another board grade.
- [ ] Preserve the institute-specific organization scope and existing fallback rule.
- [ ] Keep every class in the returned list available for deliberate selection.
- [ ] On class change, immediately clear subject, subject choices, source choices, and selected source.
- [ ] Reload subjects, then reload documents for the selected class/subject.
- [ ] Preserve the existing single-result auto-selection behavior (one subject, then one document).
- [ ] Keep the question interface hidden until a document/source is selected.
- [ ] Do not implement local class availability, local document filtering, or a bypass for the `/api/documents` profile-class restriction.
- [ ] Treat cross-grade source loading as blocked until the backend's document-list access rule is intentionally updated.

## Source references

- Web class default and class-change behavior: `src-frontend/pages/StudentPortal.jsx`
- ID matching and board/institute fallback: `src-frontend/utils/availableClassSelection.mjs`
- Available-class endpoint: `main.py` around `/api/student/available-classes`
- Available-subject endpoint: `main.py` around `/api/student/available-subjects`
- Document-list endpoint and profile-class filter: `main.py` around `/api/documents`
- Focused default-selection tests: `tests/frontend/available-class-selection.test.mjs`

This handoff documents existing source behavior only. No actual student records, credentials, or textbook images are included.
