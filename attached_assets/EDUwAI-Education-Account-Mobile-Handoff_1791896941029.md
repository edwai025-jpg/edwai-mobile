# EDUwAI Mobile Handoff: Education & Account

## Purpose and scope

Reproduce the existing My Profile → Education and Account functionality in the mobile application's existing stack, using the existing EDUwAI backend. This is a handoff specification, not a new backend or a website change.

Both the Markdown and PDF contain the same reference text. The original extraction's planning instructions have been removed; the complete UI/API/OTP extraction is retained below with mobile integration notes.

**Scope:** Education and Account, including their necessary shared profile state, authenticated HTTP transport, OTP panels, confirmation dialog, feedback, and Account Danger Zone. Payment, Settings, Security, profile-photo implementation, and a new login/signup system are excluded.

**Verification boundary:** Based on the inspected workspace source. This export did not send OTPs, modify users, delete accounts, or check a live production deployment. Existing limitations are recorded rather than fixed or presented as guarantees.

## Mobile implementation boundary

- Reuse the existing backend and database. Do not implement a parallel user, education, OTP, credit, history, or subscription service.
- Use the mobile application's existing authentication session. These profile mutations identify the current user through the bearer token, not a client-supplied user ID.
- Use the existing mobile UI toolkit; the conceptual component names below are a mapping guide, not exported web components or mandatory new dependencies.
- Preserve the distinction between draft data and authoritative saved user data.
- A Send OTP request does not save a contact. A successful authenticated Verify-for-profile response DOES save that contact immediately.
- Name/remaining account fields require Account Save. There is no combined endpoint that atomically replaces both contacts and the name.
- Keep current-account history, subscriptions, and usage associated with the same server user ID. Do not reset local usage or make a new account to apply profile edits.
- Do not substitute the login/create-account OTP endpoints for the profile verification endpoints.
- Do not introduce a new deferred-contact proof token, OTP route, or backend workflow as part of reproducing these tabs.

## Suggested native UI structure

Use these conceptual equivalents in the existing mobile project:

| Native equivalent | Existing behavior to reproduce |
|---|---|
| ProfileSettingsScreen | Scrollable My Profile container; saved-user initialization; Education and Account selectors; close/back handling |
| EducationTab | Four dependent pickers or institution-managed read-only fields |
| AccountTab | Name, email, fixed +91 phone prefix, verification status, Account Save, password-login notice, Danger Zone |
| ContactOtpPanel | Target contact; Send/Resend; visible six-digit input; Verify; busy/error states; email draft cancellation |
| ContactChangeDialog | Old/new values; account/login warnings; Cancel/Confirm; confirm only initiates authenticated verification |
| ProfileStatusFeedback | Success/error feedback and persistent actionable errors |

Layout outline:

```text
My Profile
  Education | Account
  Education (consumer)
    Helper text
    State picker
    Board picker
    Class picker
    Medium picker
    Save Education Details
  Education (institution student)
    Institution-managed notice
    Institute / Class / Medium (when available)
  Account
    Full Name
    Email + Verified badge when applicable
    Email OTP panel for a valid new/unverified email
    Phone: fixed +91 prefix + local ten digits
    Phone Verified / Not verified badge
    Phone OTP panel for a valid new/unverified phone
    Password login is disabled notice
    Save Account Details / Send OTP to verify changes
    General validation error
    Danger Zone (delete confirmation)
  Contact-change dialog appears above the current tab
```

The full reference below records the existing web appearance and exact UI copy. Native controls should preserve those meanings and states rather than attempt to run Tailwind/DOM components.

Native-only adaptations:
- Use native pickers/selectors for the existing ID/name option lists.
- Place email, phone, and OTP input in a keyboard-safe scroll container.
- Use email and telephone input types; OTP keyboard should be numeric, preserve leading zeroes, and keep the code as a string.
- OS OTP autofill fills the input but must not automatically confirm or save the contact. Keep the explicit Verify and confirmation steps.
- Translate web aria labels/live errors into the mobile stack's accessible labels and announcements.
- On mobile there is no window.location.reload: after a successful education save, refresh the authoritative user and reinitialize academic dashboard selection through its existing APIs. Do not invent a new subject/document endpoint in this handoff.
- Replace browser localStorage with the mobile project's existing user/session storage. Store real access/refresh credentials in secure storage, never ordinary logs or source files.
- On back/close after successful verification, the contact is already saved; do not present cancellation as rollback.
- If a response is lost after a verification request, read the authoritative profile before retrying; a network error alone does not prove the contact is unchanged.

## API base and native session integration

The web source configures its non-development backend base as:

```text
https://api.eduwai.in/api
```

This is the configured backend origin found in source, not a live-availability certification. Confirm the mobile project's existing environment configuration before shipping. The /api paths below must not be appended to a base that already contains /api a second time.

For example:
- Base = https://api.eduwai.in/api → append /student/profile/account.
- Base = https://api.eduwai.in → append /api/student/profile/account.

Protected JSON requests carry:

```text
Authorization: Bearer <existing access token>
Content-Type: application/json
```

Do not embed any provider API key in the mobile client. OTP delivery happens server-side.

The refresh endpoint supports the existing native session's refresh token in the body, or an existing browser-style refresh cookie:

```http
POST /api/auth/token/refresh
Content-Type: application/json

{"refresh_token": "<existing refresh token>"}
```

The success body contains access_token, token_type ("bearer"), and user. Do not assume it returns a newly rotated refresh_token. Missing/invalid/expired refresh credentials return 401.

Apply the existing session client's single-refresh/retry-once policy. Browser cookie/withCredentials behavior should not be copied as an assumption that a native networking library automatically has those cookies. If the mobile project already uses cookie-based refresh, retain that established integration.

Any institution subdomain routing header must come from the existing institution context; do not fabricate an organization slug from student input.

## Compact API index

| Method and path | Request | Response/mutation |
|---|---|---|
| GET /api/states | No body | State ID/name list |
| GET /api/boards/{state_id} | Integer State path parameter | Boards in State |
| GET /api/classes?board_id={id} | Optional integer Board query | Class ID/name list |
| GET /api/mediums?class_id={id} | Optional integer Class query | Medium ID/name list |
| PUT /api/student/profile/education | board_id, class_id, medium_id | Saves education; partial user response |
| PUT /api/student/profile/account | full_name, unchanged email/phone; optional legacy password | Saves name/remaining fields; rejects direct new contacts |
| POST /api/auth/email/send-otp | email | Sends to new target; no contact save |
| POST /api/auth/phone/send-otp | phone | Sends to new target; no contact save |
| POST /api/auth/email/verify-for-profile | email, otp | Immediately saves verified email on current user |
| POST /api/auth/phone/verify-for-profile | phone, otp | Immediately saves verified phone on current user |
| GET /api/auth/me | Bearer token; no body | Canonical user directly, not {user: ...} |
| POST /api/auth/token/refresh | Existing cookie or refresh_token | New access token and user |
| DELETE /api/student/profile | Bearer token; no body | Account deletion |

The send and lookup handlers are public; profile verification, mutations, user refresh, and deletion are protected. Token refresh uses the existing refresh credential rather than requiring a current access token.

## Mobile acceptance checklist

1. Reopen profile from the saved server user, with local drafts reset as documented.
2. State changes reset Board/Class/Medium; Board resets Class/Medium; Class resets Medium.
3. Institution students receive the read-only education view and cannot save that tab.
4. Education Save sends only Board/Class/Medium IDs and refreshes academic context.
5. Name-only Save requires no OTP and displays the normalized server name.
6. Each valid new/unverified contact has a code input visible before Send.
7. Send delivers to the draft/new target; old saved contact remains until verification.
8. Invalid/expired codes retain the old contact and keep a retryable OTP panel.
9. Verify changed contact requires confirmation; cancelling confirmation issues no mutation.
10. Successful verification immediately replaces only that contact and updates saved-user state.
11. Editing a target clears that channel's old local code/sent state.
12. Main Save sends pending codes but does not save an unverified contact or pending name.
13. Both-contact edits remain independent; success on one is not rollback if the other fails.
14. Phone removal uses empty string, not null, and honors the remaining-login guard.
15. Empty existing-email removal is not offered as a supported save operation.
16. An ambiguous mutation response is reconciled before a deliberate retry.
17. Session expiry reuses existing refresh/sign-in handling, not a new account.
18. Contact editing does not reset question counters, credit balances, history, or subscription.
19. No actual deletion is run during handoff verification.

## Contents of the full extraction

The following sections cover: component inventory and lifecycle; local state; HTTP transport; Education UI and APIs; Account validation; OTP component props; triggers and action sequences; OTP endpoints, lifecycle and delivery; confirmation copy; Account PUT and bypass protection; user refresh; notifications/cancellation; Danger Zone; action matrix; existing limitations.


## Extracted reference: scope and key rules

This is a source inspection, not an executed end-to-end test. Example contacts and OTPs below are fictional.

1. Education changes require no OTP.
2. Name changes require no OTP.
3. A new email or new phone requires OTP delivered to the NEW contact, not the old contact.
4. Sending an OTP never saves the new contact.
5. Clicking Verify first opens a confirmation dialog if the draft contact differs from the saved contact. Confirming then calls the authenticated verification API.
6. Successful verification IMMEDIATELY saves that contact on the existing account. It is not deferred until Save Account Details.
7. Name and other pending account fields require the separate account Save operation.
8. Email and phone changes are independent transactions; changing both is not an atomic all-or-nothing operation.
9. These handlers retain the same user ID and do not reset questions, history, subscription, credits, or usage.
10. Login/signup OTP verification is a different flow. Do not substitute `/api/auth/email/verify-otp` or `/api/auth/phone/verify-otp` for the profile verification endpoints.

## 1. Component inventory and modal lifecycle

| Element | Current implementation | Behavior |
|---|---|---|
| My Profile modal | Inline JSX in StudentPortal, not a standalone profile component | Fixed full-screen black 50% backdrop with blur; centered scrollable panel; max width 2xl; horizontal margin; max height 90vh |
| Shared header | Avatar, My Profile title, subtitle, Close button | Subtitle: “Manage your account settings”; Close has aria-label “Close” |
| Education tab | Inline conditional on `profileTab === 'education'` | Four editable selects for consumer students, read-only institution view for organization students |
| Account tab | Inline conditional on `profileTab === 'account'` | Full Name, Email, Phone Number, verification panels, password-login notice, account Save, Danger Zone |
| Contact verification | `ProfileContactVerification` | Used separately for email and phone |
| Contact-change confirmation | Inline sibling dialog | Above profile modal; accessible dialog role, aria-modal, labelled title |
| Profile result notification | Inline centered toast | Green success/red error; dismiss button; success progress bar |

Styling uses the existing theme: `isPrimary` means primary/dark mode. Main text is white in primary mode and gray-900 otherwise. Cards use `bg-[#1e1e2e]/90` or white; borders use primary/30 or gray-200. Inputs are full width, rounded-lg, bordered, with horizontal padding 4 and vertical padding 2.5. Save buttons are full-width purple, rounded-lg, with hover and disabled-opacity states.

Opening My Profile:
- Copies saved `user` fields into a shared draft: `stateId`, `boardId`, `classId`, `mediumId`, `fullName`, `email`, and the local ten-digit `phone`.
- Initializes missing values to empty strings.
- Removes a leading `+91` from the stored phone for editing.
- Resets both channels' sent/code/error/just-verified state; clears name/general errors, delete confirmation, and pending contact confirmation.
- Empties dependent option arrays, then loads States and the saved State's Boards, saved Board's Classes, and saved Class's Mediums where IDs exist.
- Shows the modal without waiting for those requests to finish.
- Does not fetch a fresh user profile before copying the draft.
- Does not reset the selected tab on every open. Education is the initial tab when the page first mounts; the last tab can remain selected on reopen.

Switching tabs preserves the shared draft and OTP state. It clears only `profileError` and `profileSuccess`; it does not cancel a network request or clear channel errors/codes.

Closing the modal does not undo an already verified/saved contact. Reopening discards unsaved drafts and copies the current saved user again. The inspected modal has an explicit Close button; no dirty-draft confirmation, backdrop-close handler, Escape handler, or focus trap is implemented in this block.

The profile photo controls belong to the shared header and are outside this two-tab extraction.

## 2. Local state and field mapping

| UI draft | API/model field | Notes |
|---|---|---|
| `profileForm.stateId` | State lookup/Board relationship | NOT included in Education PUT |
| `profileForm.boardId` | `board_id` | Select value is typically a string; request schema expects optional integer |
| `profileForm.classId` | `class_id` | Same conversion behavior |
| `profileForm.mediumId` | `medium_id` | Same conversion behavior |
| `profileForm.fullName` | `full_name` | Server normalizes whitespace |
| `profileForm.email` | `email` | Trimmed for send/verify/save; not lowercased |
| `profileForm.phone` | `phone` | Ten local digits in UI; `+91` prepended for API |
| `newPassword`, `confirmPassword` | `password` for newPassword only | Legacy draft/handler support; no password-edit inputs rendered in Account |

Additional state:
- Modal visibility and selected tab: `showProfileModal`, `profileTab`.
- Shared save state: `profileLoading`, `profileError`, `profileSuccess`.
- Field errors: `emailError`, `phoneError`.
- Options: `availableStates`, `availableBoards`, `availableClassesForProfile`, `availableMediums`.
- Each OTP channel: `OtpSent=false`, `OtpCode=''`, `OtpLoading=false`, `OtpError=''`, `JustVerified=false`.
- Confirmation: items/action label in state; pending callback in a ref.
- Notifications: toast `{type,message}`, progress, timeout and interval refs.
- Deletion: `showDeleteConfirm`, `deleteAccountConfirm`.

## 3. HTTP transport and authentication

All paths in this reference include `/api`. Frontend calls omit that prefix because `config.apiUrl` supplies it. Development uses the Vite `/api` proxy; recognized production hosts use the configured backend base plus `/api`. No production availability was checked.

The shared Axios client:
- Uses `withCredentials: true`.
- Adds `Authorization: Bearer <access_token>` when the auth store holds an access token.
- For recognized non-development institute subdomains, forwards `X-Org-Subdomain` for organization routing.
- On a 401, attempts `POST /api/auth/token/refresh` with credentials and an empty JSON body, updates the access token/user, and retries once. Concurrent failed requests are queued during refresh.
- On refresh failure, clears authentication and redirects to `/login`.
- On a 402, emits the existing payment-required event and rejects the request; that is a shared transport behavior, not a new feature in these tabs.

Protected APIs identify the account from the JWT subject/user ID. The client does NOT send a target `user_id` for profile mutations. Missing/invalid authentication normally returns 401.

Lookup GETs and OTP SEND endpoints have no `get_current_user` requirement in their handlers. The signed-in web client still sends its bearer header automatically. OTP VERIFY-for-profile, user refresh, education/account writes, and deletion are authenticated.

Schema-validation failures can use FastAPI's structured 422 `detail` array; business-rule errors generally use a string `detail`. Current inline error handlers often assign `detail` directly, rather than explicitly formatting a structured error array.

## 4. Education UI, selection dependencies, and role differences

Consumer tab helper text:
“Update your education details to see relevant study materials on the student portal.”

| Field | Placeholder | Enabled when | On change |
|---|---|---|---|
| State | Select State | Always | Sets State; clears Board/Class/Medium drafts; clears Classes/Mediums options; loads Boards |
| Board | Select Board, or Select a state first | State has a value | Sets Board; clears Class/Medium drafts; loads Classes; clears Mediums options |
| Class | Select Class | Board has a value | Sets Class; clears Medium draft; loads Mediums |
| Medium | Select Medium | Class has a value | Sets Medium only |

Option keys/values are record IDs; visible text is `name`. Server ordering is by name. The Classes endpoint returns all classes for the selected board, not only classes with processed textbooks. It is distinct from the dashboard's available-classes endpoint.

Save Education Details is disabled only while `profileLoading` is true. It is not disabled because selections are empty or lookup requests are pending. Dropdowns are not disabled merely because a save is running.

Lookup failures are logged:
- Board/Class/Medium arrays become empty on failure.
- State loading logs the error without an explicit reset.
- No dedicated loading spinner, inline lookup-failure message, or retry button is rendered for these four selects.
- These loader functions have no stale-response/request-fencing mechanism.

Institution students:
- UI uses `user.org_role === 'student' && user.org_id` to select the read-only view.
- Shows: “Your education details are managed by your institution and cannot be changed here.”
- Optionally displays Institute (`org_name`), Class (`class_name`), and Medium (`user.medium`) when present.
- No dropdowns or Save Education Details button.
- Backend Education PUT blocks `org_role === 'student'`, even without the additional UI `org_id` condition.
- The canonical auth user serializer returns `medium_name`, while this read-only UI checks `medium`; a client reproducing it should distinguish this existing mismatch rather than assume the field names are identical.

## 5. Education APIs

### GET /api/states
No request body; public handler. Returns an alphabetically ordered array:
```json
[{"id": 1, "name": "Example State"}]
```

### GET /api/boards/{state_id}
Integer path parameter; public handler. Filters by State and sorts by Board name. Response items:
```json
{
  "id": 2,
  "name": "Example Board",
  "is_restricted": false,
  "processing_delay_minutes": 5,
  "page_display_mode": "original"
}
```
The dropdown uses only `id` and `name`.

### GET /api/classes?board_id={board_id}
Optional integer query parameter; public handler. This is the exact route used by My Profile, not `/api/classes/{board_id}`. Response: array of `{id,name}`, sorted by name. An omitted/falsey filter returns all classes.

### GET /api/mediums?class_id={class_id}
Optional integer query parameter; public handler. Exact route used by My Profile, not `/api/mediums/{class_id}`. Response: array of `{id,name}`, sorted by name. An omitted/falsey filter returns all mediums.

### PUT /api/student/profile/education
Authenticated. Request schema contains ONLY three optional integer fields:
```json
{"board_id": 2, "class_id": 3, "medium_id": 4}
```
Empty dropdowns are sent as `null`. State is NOT sent.

Server behavior:
- Finds the current account, not a newly created account.
- Rejects institution-managed students with 403.
- Checks each supplied Board/Class/Medium exists.
- Updates `board_id`, `class_id`, `medium_id` and associated names.
- Derives State name through the chosen Board's State.
- A missing/null/falsey Board, Class, or Medium clears that corresponding selection/name; omitted values also default to null in this PUT schema.
- Commits and returns:
```json
{
  "success": true,
  "message": "Education details updated successfully",
  "user": {
    "state": "Example State",
    "board": "Example Board",
    "board_id": 2,
    "class_name": "10",
    "class_id": 3,
    "medium_name": "English",
    "medium_id": 4
  }
}
```

Relevant business errors:
- 403: institution-managed education cannot be changed here.
- 404: `User not found`.
- 400: `Invalid board selected`, `Invalid class selected`, or `Invalid medium selected`.
- 422: malformed request types.

Frontend success path:
1. Merges `response.user` into localStorage's `user`.
2. Shows “Education details updated successfully!”
3. Immediately calls `window.location.reload()`.
4. Therefore the in-memory store is not separately updated by this handler before reload; the reload reinitializes the page and academic context.

Failure path shows the server's detail, or “Failed to update education details”. There is no OTP, contact confirmation, or account-name write in this operation.

Important existing boundaries:
- The handler checks existence individually, but does not check that the submitted Class belongs to the submitted Board or Medium to the submitted Class.
- It does not explicitly update `user.state_id` or recompute `profile_complete`.
- The serializer for `/api/auth/me` derives State/State ID through Board, rather than relying on the education PUT's partial response.
- The save handler assigns/returns legacy `user.state` and `user.board` attributes; the inspected mapped User model defines `state_id`/`board_id`, not mapped `state`/`board` columns. Do not treat those legacy name assignments as proven persisted fields. In particular, the blank-Board response path does not assign State before reading it and was not runtime-tested here.

## 6. Account UI and validation

Visible introductory copy currently says “Update your account information and manage your password.” The actual visible notice says password login is disabled; no password-edit inputs are present.

### Full Name
- Text input; placeholder “Your full name”.
- UI `maxLength=101`, and changes are sliced to 101 characters.
- Name validation uses the trimmed value with repeated whitespace collapsed.
- Required; 2–100 normalized characters.
- Allows Unicode letters, spaces, straight apostrophes, and hyphens.
- Frontend rejects digits, emoji, dots, and other punctuation.
- Backend additionally requires at least one letter; punctuation-only names can pass the frontend character test but fail the backend.
- Backend persists the normalized name.
- Unicode combining marks are not separately admitted by these validators.
- Typing clears general profile errors. The name input is not disabled by the contact-loading flags.
- Name-only Save issues Account PUT directly, with unchanged contacts; no OTP or contact confirmation.

Name frontend errors:
`Name is required`; `Name must contain at least 2 characters`; `Name must be 100 characters or fewer`; `Name can contain only letters, spaces, apostrophes, and hyphens`.
Backend versions use equivalent wording with punctuation and additionally `Name must contain letters.`

### Email
- `type=email`; placeholder `your@email.com`.
- Input is disabled during account save or either channel's OTP request.
- Typing stores the raw draft, validates it, and resets email sent/code/OTP error/just-verified state.
- API operations use `.trim()`; no automatic lowercase conversion.
- Comparisons against saved email are case-sensitive.
- A green Verified badge appears only if `user.email_verified` and the saved email exactly matches the trimmed draft.
- Verification panel appears for a nonempty, valid trimmed email that is not that already-verified saved email.
- The code input is visible before sending.
- “Cancel email change” restores the current saved email using the ordinary change handler and clears draft OTP state. It does not call an API or undo a completed replacement.

Email rules, frontend and corresponding backend:
1. Required for email operations.
2. Maximum 254 characters; minimum 5.
3. Exactly one `@`.
4. Nonempty local part, maximum 64 characters.
5. No whitespace in local part.
6. First local character must match Latin/digit/underscore, extended Latin U+00C0–U+024F, or Devanagari U+0900–U+097F.
7. Local part cannot start/end with a dot or contain consecutive dots.
8. Domain must be nonempty and contain a dot.
9. Domain cannot start/end with a dot or contain consecutive dots.
10. Final domain extension must have at least two characters.

These are the implemented checks, not a complete standards-compliant mailbox validator. There is no DNS/mailbox-existence check before OTP sending. Backend email-format errors use 422; messages identify the failed rule.

An existing email cannot be removed by clearing the input: account Save validates an empty draft if a saved email exists. A phone-only account with neither saved nor drafted email may save its name without adding email. The change handler can still show an “Email is required” field error for an empty draft independently of that Save exemption.

### Phone Number
- Fixed noneditable `+91` prefix next to a `type=tel` input.
- Placeholder “10-digit phone number”; maximum ten input characters.
- Changes strip all nondigits and keep the first ten digits.
- Enter the local number, not an entire international number: the field's paste sanitization does not separately remove a pasted country code.
- Optional; empty draft is valid format.
- Nonempty number must have exactly ten digits, beginning with 6, 7, 8, or 9.
- Partial numbers show “Phone number must be exactly 10 digits”.
- Invalid first digit shows “Indian mobile numbers start with 6, 7, 8, or 9”.
- Editing clears phone sent/code/OTP error/just-verified state.
- Input is disabled during account save or either channel's OTP request.
- Verified badge uses normalized saved/draft numbers and `phone_verified`; otherwise a nonempty draft gets Not verified.
- Verification panel requires a valid ten-digit draft that is not the exact already-verified saved `+91` number. A verification-related field error does not hide it.
- Successful verification shows “Phone number verified and saved to your existing account.”
- There is no dedicated Cancel phone change button in the current verification component usage.

Backend normalizes surrounding whitespace and accepts `+91` plus local number, twelve digits starting `91`, or ten local digits starting 6–9. Final required shape is `^\+91[6-9]\d{9}$`. It does not generally strip internal punctuation.

Client comparison normalization strips nondigits, treats twelve digits starting `91` as already country-prefixed, and otherwise adds `+91`. Thus a ten-digit local number beginning `91` is not mistaken for a country code.

## 7. OTP verification component contract

Props: `channel`, `target`, `sent`, `code`, `loading`, `disabled`, `error`, `isDark`, `onSend`, `onVerify`, `onCodeChange`, optional `onCancel`.

- Section accessible label: Email verification / Phone verification.
- Heading: “Verify email/phone before changing it”.
- Before sending: target contact and explanation that the current contact stays unchanged.
- After sending: “OTP sent to [target]. Enter the 6-digit code below.”
- Description uses `aria-live=polite`.
- Send link: “Send OTP to new email/phone”; becomes “Resend OTP” after sending.
- Code field: `type=text`, `inputMode=numeric`, `autoComplete=one-time-code`, `maxLength=6`.
- Placeholder: “Enter 6-digit OTP”.
- Accessible input label: Email verification OTP / Phone verification OTP.
- Code sanitization removes nondigits and keeps six digits.
- Verify button: “Verify OTP and change email/phone”.
- Send, code input, and optional Cancel are disabled while busy; busy combines own loading with parent disabled state.
- Verify is additionally disabled until an OTP has been sent and the draft code matches exactly six digits.
- Busy labels show “Please wait...”.
- OTP errors are rendered inside the panel with `role=alert`. The panel/code controls remain available after an error.
- No countdown timer, resend cooldown, attempt counter, OTP auto-submit, or automatic resend is implemented.

## 8. Exact OTP triggers and contact action sequences

### Drafting alone
Typing a contact never sends an OTP. It resets the channel's local verification state. A previously sent server OTP is not explicitly revoked merely because the local draft changed or was cancelled.

### Explicit Send / Resend
1. Validate the target.
2. Set channel loading; clear OTP error and code.
3. POST the new contact to its SEND endpoint.
4. On request success, mark that channel sent.
5. On failure, display the server detail or “Failed to send OTP. Please try again.”
6. Clear loading in finally.

The handlers do not read or display `dev_otp`. They treat a successful HTTP request as sent, rather than explicitly validating a `sent` response property. They do not reset an already-true sent flag at the start of resend; a failed resend can therefore leave the old local sent flag true even though the server has invalidated the earlier code.

### Main Account Save with changed contacts
1. Set shared loading and clear general errors.
2. If a legacy newPassword exists, validate it and its matching confirmation.
3. Validate name, applicable email, and any nonempty phone.
4. Compare trimmed email and normalized phone against the saved auth-store user.
5. If email changed, send its OTP unless already marked sent.
6. If a nonempty phone changed, send its OTP unless already marked sent.
7. If both changed, email send is awaited first, then phone send. Each channel catches its own send failure, so phone can still be attempted after an email failure.
8. Return WITHOUT Account PUT. Name/other account drafts are not saved at this stage.
9. Repeated Save does not resend already-marked-sent channels; explicit Resend does.

Button copy: changed email or changed nonempty phone → “Send OTP to verify changes”; otherwise “Save Account Details”. During shared loading → spinner and “Saving...”, including while Save is initiating OTP sending.

### Verify changed email
1. Reject a code that is not exactly six digits: “Please enter the 6-digit OTP”.
2. Show contact confirmation with saved and draft email.
3. Cancel confirmation → no verification request, no mutation; OTP/code draft remains.
4. Confirm → POST authenticated email VERIFY-for-profile.
5. Success → save returned user via `updateUser`; clear sent/code; set email just-verified; clear email format error.
6. Error → retain saved user/contact and show server detail or “Invalid or expired OTP”.

Phone follows the equivalent sequence. An unchanged but unverified contact may be verified without a change-confirmation dialog because old and new values match.

If a verification response is ambiguous (for example, a server save followed by a lost response), the current client error path does not automatically refresh user state before a retry. A failed request is not proof that the server did not save; a separate client should reconcile with `/api/auth/me`.

### Saving a name after contact verification
Once returned user matches draft contacts, Account Save can PUT the name/unchanged contacts. This is not required to make the verified contact replacement effective.

### Clearing/removing phone
- Empty phone is explicit removal, not OTP verification of an empty target.
- Account Save shows a contact-change confirmation with New: Removed.
- Confirm calls Account PUT with `phone: ""`.
- Server permits removal only when a verified nonempty email or linked Google identity remains.
- Removal sets phone to null and phone_verified to false.
- Attempting to remove the only login phone returns 400.
- `phone: null` or omitted phone means leave unchanged, not remove.

## 9. OTP APIs and response/error contracts

### POST /api/auth/email/send-otp
Public handler. Body:
```json
{"email": "learner@example.invalid"}
```
Validates email; trims target. Success in GCP mode: `{"sent": true}`.
Non-GCP mode: `{"sent": true, "dev_otp": "123456"}` (example only).
Errors: 422 invalid email/schema; 503 delivery unavailable.
Delivery error text: “Email OTP could not be sent. Please check the address and try again.”

### POST /api/auth/phone/send-otp
Public handler. Body:
```json
{"phone": "+916123456789"}
```
Normalizes/validates Indian phone. Same sent/dev response shape.
Errors: 400 invalid phone; 422 malformed schema; 503 SMS delivery unavailable.
Delivery error text: “SMS OTP service is temporarily unavailable. Please use email or Google login.”

### POST /api/auth/email/verify-for-profile
Authenticated. Body:
```json
{"email": "learner@example.invalid", "otp": "123456"}
```
Success:
```json
{"success": true, "user": {"id": 42, "email": "learner@example.invalid", "email_verified": true}}
```
The example shows only relevant user fields; the actual response contains the full auth-profile object described below.
Errors: 401 unauthenticated; 404 User not found; 422 email/schema invalid; 400 Invalid or expired OTP; 400 This email is already linked to another account.

### POST /api/auth/phone/verify-for-profile
Authenticated. Body:
```json
{"phone": "+916123456789", "otp": "123456"}
```
Same success envelope, with updated phone and phone_verified=true.
Errors: 401 unauthenticated; 404 User not found; 400 invalid phone; 422 malformed schema; 400 Invalid or expired OTP; 400 This number is already linked to another account.

Verification mutation details:
- Looks up current user by authenticated ID.
- Checks another account does not own the target.
- Verifies/consumes the OTP for exact normalized identifier and channel.
- OTP consumption commits separately.
- Reacquires the account row with fresh state and a row lock.
- Rechecks uniqueness, assigns the one verified contact, and commits.
- Catches unique-constraint races and rolls back with the same linked-to-another-account message.
- Returns the same account's user object, not new login tokens.
- Does not change Google identity, auth provider, subscriptions, or usage.
- Does not send an alert or OTP to the retired contact in these handlers.
- If a conflict occurs after OTP consumption, that code may already be used even though replacement failed.

## 10. OTP lifecycle, persistence, and delivery

Current OTP service:
- Generates six decimal digits in the range 100000–999999.
- Stores a SHA-256 hash, not the raw code.
- Session fields: identifier, channel, otp_hash, attempts, verified, expires_at, created_at, ID.
- Lifetime: ten minutes.
- Maximum verification attempts: three. A successful third permitted attempt succeeds; a third mismatch removes the session.
- New SEND deletes all earlier unverified sessions for the same identifier and channel before creating a replacement.
- Resend therefore invalidates the previous code.
- VERIFY loads the newest unverified matching session with a row lock.
- Missing, expired, exhausted, mismatched, or already-consumed OTPs fail. Expired/exhausted sessions are removed.
- A correct code marks the session verified/consumed and cannot be replayed.
- Session scope is identifier + channel, not a separate profile-operation purpose or requesting account ID.
- SEND uses the same OTP infrastructure as login, but profile mutation must use authenticated VERIFY-for-profile.
- No send cooldown or per-identifier/IP send rate limit is implemented in the inspected SEND handlers/service.

Delivery:
- `PLATFORM == "gcp"` selects actual delivery.
- SMS uses MSG91 Flow API, with server-side credentials/template and a ten-second HTTP timeout.
- Email delegates to the existing SendGrid-backed OTP email helper, with ten-minute-expiry text and EDUwAI branding.
- Production returns only the sent flag.
- On delivery failure, the newly created OTP session is discarded and SEND returns 503.
- Outside GCP mode the service returns a development code and does not perform real delivery. The current profile UI does not expose that returned development code.
- No credentials or provider keys belong in a client or exported reference.

## 11. Contact-change confirmation details

Title: “Confirm login detail change”.
Intro: “This changes the contact details linked to your existing account.”

Each item displays:
- Field label: Email address / Phone number.
- Previous: saved value, or Not set.
- New: draft value, or Removed.

Warnings:
- Old contacts will no longer work for email/phone OTP login to THIS account.
- Use the new details or another sign-in method that remains linked.
- Existing questions, saved history, and usage stay with the account; contact changes do not reset them.
- Email-specific warning: replacement happens only if the new email OTP successfully verifies.
- If `user.google_id` is true, linked Google sign-in remains available unless separately changed.

Buttons:
- Cancel: clears pending action and closes confirmation, without API mutation.
- Confirm label: Verify and change email, Verify and change phone, or Confirm change for phone removal.
- Confirmation itself is a client UX step; the API does not take a confirmation flag.

The dialog is max-width-lg, fixed above the profile modal, with backdrop, responsive button stacking, `role=dialog`, `aria-modal=true`, and `aria-labelledby=contact-change-title`.

## 12. Account PUT and server-side bypass protection

### PUT /api/student/profile/account
Authenticated. Optional request fields: full_name, email, phone, password.
Typical current UI request:
```json
{
  "full_name": "Example Learner",
  "email": "learner@example.invalid",
  "phone": "+916123456789"
}
```
JavaScript undefined email/password properties are omitted during JSON serialization. Blank phone is sent as an empty string.

Success: `{"success": true, "message": "Account details updated successfully"}`. No user object is returned by this endpoint.

Server:
- Locks and freshly loads the current user.
- Validates optional supplied email and phone.
- Rejects changed identifiers BEFORE applying the name/password/removal.
- Validates/normalizes supplied name and saves it.
- Preserves verification flags when unchanged contacts are resubmitted.
- Allows empty-phone removal subject to the alternate-login guard.
- Legacy password support hashes a supplied valid password; frontend does not expose password editing.
- Commits existing account changes.

Exact guard errors:
- 403: “Verify your new email with OTP using /api/auth/email/verify-for-profile before saving.”
- 403: “Verify your new phone number with OTP using /api/auth/phone/verify-for-profile before saving.”
- 400: “Verify an email before removing your only login phone number.”

Other errors: 401 invalid auth; 404 User not found; 422 invalid name/email/phone/schema; 400 weak legacy password.
Password rules if directly supplied: at least eight characters, a digit, an ASCII letter, and one of the implemented special characters. The visible UI nevertheless says password login is disabled.

Client success handling:
1. Optimistically stores draft name/email/phone into localStorage.
2. Calls `refreshUser()` → authenticated GET `/api/auth/me`.
3. Shows “Account details updated successfully!”
4. Clears newPassword/confirmPassword draft.
5. Keeps the modal open; no page reload.

`refreshUser()` logs failures internally rather than rejecting, so an Account PUT success can still show success if the subsequent refresh failed.

### Related guard: PATCH /api/auth/me/profile
Not called by these two tabs, but relevant to preventing direct profile-update bypass.
Optional fields: full_name, state_id, board_id, class_id, medium_id, phone, terms_accepted.
It uses the same phone-change/removal guard; does not provide an email-update field; validates name; can update academic IDs and profile-complete status.
This separate handler is not interchangeable with Education PUT: it has different null/omission semantics and does not contain the Education PUT's institution-managed role check.

## 13. Canonical user refresh and identity preservation

### GET /api/auth/me
Authenticated; no request body. Returns the canonical user object directly, not inside `{user: ...}`.

Fields returned by this GET handler:
`id`, `email`, `phone`, `full_name`, `state`, `state_id`, `board`, `board_id`, `class_id`, `class_name`, `medium_id`, `medium_name`, `is_admin`, `role`, `auth_provider`, `phone_verified`, `email_verified`, `profile_complete`, `google_id`, `profile_photo_url`, `org_id`, `org_name`, `org_payment_type`, `org_role`, `is_pre_registered`, `terms_accepted_at`.

The contact-verification and token-refresh responses use a separate shared serializer. It returns these same core fields plus `org_slug` and `org_subdomain`. The GET is implemented in main.py; the verification serializer is in auth_router.py. These response shapes should not be assumed byte-for-byte identical.

Important:
- `google_id` here is a boolean indicating a linked identity, not the private Google subject.
- State and State ID are resolved through Board.
- User response does not include question history, credit balances, or subscriptions; omitting them is not resetting them.
- `updateUser()` replaces auth-store user, writes localStorage user, and updates profileComplete.
- `refreshUser()` merges returned canonical fields into existing user and updates the same storage/store.
- Access token is held in memory; user profile is cached in localStorage.
- Contact changes mutate users.email/users.phone on the authenticated ID. Both identifiers are unique nullable database fields.
- Existing questions remain related to that ID. These handlers do not create another account, transfer records, or reset entitlement counters.
- Existing sessions are not revoked by these contact-verification handlers.
- The account/education/verify handlers inspected here do not recompute profile_complete. The separate profile-update flow computes regular completion from full_name + board_id, or terms acceptance for pre-registered students.

## 14. Notifications, errors, cancellation, and cross-tab behavior

- Save success/error uses a centered overlay toast, with Update Successful / Update Failed.
- Success auto-dismisses after ten seconds; progress updates every 100 ms. Education reload can remove the toast before that duration.
- Errors persist until dismissed/replaced; they include “Please review the information and try again.”
- Email/phone format errors appear beneath the corresponding field; OTP errors stay inside verification panels.
- Name/password/delete confirmation errors appear in the Account tab's general error block.
- Invalid OTP does not update local saved user or intentionally save any other field.
- After success, each verification panel hides because the returned saved contact now matches its verified draft, and a success line appears.
- Account Save waits for both changed contacts to match the auth-store user before saving other fields.
- Verifying one changed contact does not save the other contact or name.
- Cancelling a later Account Save or closing the modal cannot undo previously successful verification.
- Tab buttons remain clickable during requests. Education Save is controlled by shared profileLoading, but not directly by the email/phone OTP loading flags. There is no cross-tab operation cancellation in this block.
- UI visibility/changed-contact comparisons rely on cached auth-store user, not a fresh server read on each modal open.

## 15. Danger Zone, included because it is inside Account

UI:
- “Danger Zone” and “Delete my account permanently”.
- Clicking reveals warning, a text input with placeholder “Type DELETE to confirm”, Cancel, and Delete Account.
- Exact case-sensitive `DELETE` enables the destructive button.
- Cancel hides the section and clears text.
- During request, label becomes “Deleting...”.

### DELETE /api/student/profile
Authenticated; no body. The typed DELETE confirmation is a frontend-only guard and is not transmitted or enforced as a server request field. No OTP is required.

Handler explicitly attempts removal of personal Phase 2 documents/storage files, question-cache records, document-access records, and profile photo; then deletes the User and commits. Several cleanup failures are caught and ignored, so the UI's “all associated data” warning should not be treated as a proven exhaustive cleanup guarantee.

Success: `{"success": true, "message": "Account deleted successfully"}`.
Client calls logout and navigates to `/login`.
Failure shows server detail or “Failed to delete account” and restores loading state.

Deletion is documented only. It must NOT be executed as part of this extraction.

## 16. Action matrix for reproducing these two tabs

| Action | API | Mutates account now? | OTP/confirmation |
|---|---|---|---|
| Open My Profile | Four applicable lookup GETs | No | None |
| Change State/Board/Class/Medium draft | Dependent lookup GETs | No | None |
| Save Education | Education PUT | Yes, education only | None; institution students blocked |
| Change name draft | None | No | None |
| Save name with unchanged contacts | Account PUT, then auth/me GET | Yes, name | None |
| Change valid email/phone draft | None | No | Panel becomes visible |
| Send/Resend code | Channel SEND POST | No contact mutation | New target receives OTP |
| Main Save with changed contacts | Required SEND POSTs | No | Starts pending verification |
| Verify changed contact | Confirmation, then VERIFY-for-profile POST | Yes, that one contact | Six-digit OTP + client confirmation |
| Verify same unverified contact | VERIFY-for-profile POST | Yes, verified flag | OTP, no change confirmation |
| Cancel email draft | None | No | Restores saved value; clears local OTP state |
| Cancel contact confirmation | None | No | Leaves code/draft available |
| Save remaining name after verification | Account PUT, then auth/me GET | Yes, remaining account fields | No new OTP |
| Remove phone | Confirmation, then Account PUT with empty phone | Yes | No phone OTP; alternate login required |
| Close modal after verification | None | No new mutation | Completed replacement remains saved |
| Delete account | Account DELETE, then logout | Destructive | Typed DELETE guard; no OTP |

## 17. Existing limitations, not changes requested

Keep these separate from the implemented contracts:
- Education PUT does not validate Board→Class→Medium relationships as a chain.
- Its State handling/legacy name attributes and blank-selection path need runtime verification before promising clear-all behavior.
- Education lookup UI has no explicit loading/error/retry states or stale-response fencing.
- Institution Medium display reads a different field name than canonical auth serialization.
- OTP sessions are shared by identifier/channel rather than bound to a profile-only purpose/account.
- No inspected OTP send cooldown/rate limit, countdown, or attempt display.
- Development OTP is returned by service but ignored by the profile UI.
- Resend failure may leave stale local sent state after the old server code was invalidated.
- Some frontend/server validators differ; structured 422 details are not explicitly formatted here.
- Contact verification and Account Save are independent; a later cancellation is not rollback.
- No automatic old-contact alert or existing-session revocation in the contact-change handlers.
- Modal open uses cached user; ambiguous verification failures are not automatically reconciled.
- Account copy mentions password management although the actual UI provides only a disabled-login notice.
- Account deletion uses frontend-only typed confirmation and best-effort cleanup.

No application changes, migrations, real OTP sends, destructive requests, or deployment actions were performed to create this extraction.


## Source references

- `src-frontend/pages/StudentPortal.jsx:376-423,700-819,880-1239,4498-4914,5046-5169`
- `src-frontend/components/ProfileContactVerification.jsx`
- `src-frontend/services/api.js`
- `src-frontend/config.js`
- `src-frontend/store/authStore.js`
- `auth_router.py:51-100,117-222,324-394,626-655,741-798`
- `main.py:2903-2922,3142-3186,3190-3212,7763-7777,8051-8236`
- `contact_verification.py`
- `profile_validation.py`
- `otp_service.py`
- `email_service.py:692-723`
- `database.py:300-343`
- `auth.py:328-345`
