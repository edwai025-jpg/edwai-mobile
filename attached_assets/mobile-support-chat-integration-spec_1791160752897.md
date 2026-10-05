# EDUwAI Mobile Support Chat — Integration Specification

**Prepared:** 4 October 2026  
**Audience:** Mobile application developers  
**Purpose:** Reproduce the existing home-page support chat using the existing EDUwAI APIs. Do not build another backend.

## 1. Scope and the two different chat features

The floating speech-bubble icon currently shown on the EDUwAI home page opens **EDUwAI Support**. It connects a guest or signed-in student with the EDUwAI team. It is a human-support conversation, not an AI tutor.

This specification covers that icon, the conversation UI, REST integration, optional Firestore real-time delivery, and mobile push notifications.

The student AI question-and-answer experience is a different feature. Its APIs are identified in section 18 so the mobile team does not connect the support icon to the AI query service.

### Build in the mobile project

- A reusable home-screen support button.
- A guest introduction form and a support conversation screen.
- An API client using the existing production service.
- Identity-scoped local conversation state and secure credential storage.
- Foreground message synchronization, error handling, and reconnect behavior.
- FCM device registration and notification routing if background notifications are required.
- Optionally, a Firebase/Firestore listener using the existing Firebase project.

### Do not build or duplicate

- A new API server, database, support-ticket store, or admin dashboard.
- A replacement authentication system.
- Firebase Admin token minting, database access, email sending, or FCM sending on the device.
- An AI chatbot inside the support screen.
- New backend endpoints to match assumptions made by a mobile UI.

**Recommended production mobile approach:** REST for all writes and authoritative reads, plus FCM for background notifications. Firestore is an optional foreground latency improvement. A REST-only first version works while its conversation screen is open, but does not provide native background reply notifications.

## 2. Current architecture

```text
Mobile home-screen support button
    |
    +-- Guest: introduction form
    +-- Signed-in user: support conversation composer
    |
    v
Existing EDUwAI REST API on GCP
    |
    +-- PostgreSQL: authoritative conversations and messages
    +-- Existing admin portal: team reads and replies
    |
    +-- Background Firestore synchronization: optional live delivery
    +-- Background FCM sending: device notifications
    +-- Existing email notification handling

Mobile foreground:
    REST fetch/poll OR Firestore listener + REST reconciliation

Mobile background:
    OS-delivered FCM notification; refresh the authorized thread on reopen
```

Every user message must be sent through REST. Do not write directly to Firestore. The server persists the message and handles its downstream synchronization and notifications.

Firestore or push delivery can fail or lag without removing the saved PostgreSQL message. REST remains the recovery source.

## 3. API environment and headers

The current web client's configured production API base is:

```text
https://api.eduwai.in/api
```

All endpoint paths below are relative to that base. For example:

```text
POST https://api.eduwai.in/api/support/conversation/auth
```

Use an environment-configurable absolute HTTPS base URL in the native app. Do not use the web development proxy's relative `/api` URL, `localhost`, or a hardcoded Replit preview domain as the production target.

JSON requests:

```http
Accept: application/json
Content-Type: application/json
```

Authenticated requests additionally require:

```http
Authorization: Bearer <EDUWAI_ACCESS_TOKEN>
```

Guest authorization is different: it uses the conversation's `anonymous_token`, with different parameter names on different routes. Section 7 specifies these exactly.

If the mobile app supports institute tenancy, retain the existing authentication client's tenant context and its `X-Org-Subdomain` convention where appropriate. The native app cannot infer an institute from a browser hostname. This header is not a replacement for JWT authentication or conversation ownership checks.

**Verification:** A browser-identified public request to `/api/health` returned HTTP 200, and the deployed `/openapi.json` includes the support routes and request schemas described here. Earlier default Python-user-agent probes were rejected; verify access using the actual native HTTP stack before release. This check did not create a support conversation, send a message, authenticate a user, or verify push/Firestore delivery.

## 4. Home-screen icon and entry behavior

### Existing web icon

- A floating circular button at the bottom-right.
- 56 × 56 CSS pixels, with a 24 × 24 outlined speech bubble containing three dots.
- Background: indigo 600, `#4F46E5`.
- Icon: white.
- Unread badge: red 500, `#EF4444`, with white text.
- Accessible label: **Open support chat**.
- Tooltip/title: **Chat with EDUwAI Support**.
- Shown on the current landing page, login page, and student portal.

The existing icon geometry is:

```svg
<svg viewBox="0 0 24 24" fill="none"
     stroke="currentColor" stroke-width="1.8">
  <path stroke-linecap="round" stroke-linejoin="round"
    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
</svg>
```

### Native adaptation

- Use a 56 dp circular touch target and a 24 dp icon.
- Place it about 24 dp from the right edge.
- Keep it above the bottom safe area and any tab bar. Do not copy a fixed web bottom offset that overlaps native navigation.
- Maintain the accessible label, sufficient contrast, and a minimum platform-appropriate touch target.
- Show a badge only when there are locally known unseen replies. A dot is preferable to an invented exact count.
- Use the same action on the login screen if pre-login support is available.
- Open a dedicated mobile support screen or a keyboard-safe sheet. A full screen is recommended for reliable keyboard and long-thread behavior.

### On tap

1. Determine the current identity: guest or authenticated user.
2. Load a saved conversation for that identity and API environment.
3. If one exists, open and validate that thread.
4. If none exists:
   - Guest: show the introduction form.
   - Authenticated user: show the empty composer immediately.
5. Do not create an authenticated support ticket just because the button was opened.
6. Closing the screen must preserve the saved conversation and stop foreground synchronization.

## 5. Guest and signed-in user flows

### 5.1 Guest

The existing guest UI asks for:

- Name.
- Email address or an Indian phone number.
- Optional initial support message.

Preserve the web UI's contact policy: require a nonblank name and at least one usable contact method. The phone UI shows `+91` separately and sends the entered 10 digits as `guest_phone`. Validate an entered email; recommended native validation should also reject an incomplete phone number when one is supplied.

**Important distinction:** These are client UI requirements. The current creation API's guest fields are optional in its schema; the backend does not enforce the complete web introduction-form policy.

On **Start Chat**:

1. Validate the form.
2. Call `POST /support/conversation`.
3. Save the returned conversation ID and guest token securely.
4. Show the thread and fetch its messages.
5. Set up foreground synchronization.
6. Register the device's FCM token for that conversation if notifications are enabled.

If `initial_message` is supplied, it is already saved by the creation call. Do not immediately send it again through the message endpoint.

A guest can submit the form without an initial message. The API creates an empty support conversation; later messages use the normal guest-send route.

### 5.2 Authenticated user

- Reuse the existing EDUwAI login session.
- Do not ask the user to re-enter their name, email, or phone in support.
- The backend obtains those values from the authenticated user's profile.
- An incomplete display name does not mean the support client should invent another identity; the server handles its fallback.

On the first **Send**, if there is no saved conversation:

1. Call `POST /support/conversation/auth` with the composed text as `initial_message`.
2. Save the returned conversation ID under that user and environment.
3. Fetch messages and enable synchronization.
4. Do not also POST that first text to the send-message endpoint.

For an existing conversation, use its authenticated send route.

Support requests do not need textbook selection or educational question-quota checks. Do not open a paid-question upgrade screen simply because the user asks for human support.

### 5.3 Identity changes

- Namespace authenticated state by EDUwAI user ID and API environment.
- Keep guest state separate from account state.
- On logout or account switch, detach listeners and discard the previous identity's in-memory thread.
- Never attempt to open user A's conversation with user B's JWT.
- A guest conversation does not automatically become an authenticated conversation after login.
- The current API has no guest-to-user conversation conversion endpoint.
- Route a notification according to the saved conversation's owner type, not merely whether somebody is currently signed in.

## 6. Conversation and message data

Creation response:

```json
{
  "conversation_id": 123,
  "anonymous_token": "<GUEST_TOKEN_OR_NULL>",
  "student_name": "Example User",
  "firebase_token": "<FIREBASE_CUSTOM_TOKEN_OR_NULL>",
  "firebase_available": true
}
```

`anonymous_token` is a string for guests and `null` for authenticated conversations. A Firebase token can be absent even when `firebase_available` is true; do not assume the boolean alone means a working real-time connection.

Thread fetch response:

```json
{
  "conversation": {
    "id": 123,
    "type": "support",
    "status": "open",
    "student_id": null,
    "student_name": "Example User",
    "student_email": "user@example.com",
    "student_phone": null,
    "context": null,
    "unread_admin": 1,
    "unread_student": 0,
    "created_at": "2026-10-04T10:20:00+00:00",
    "last_message": "I need help signing in.",
    "last_message_at": "2026-10-04T10:20:00+00:00",
    "anonymous_token": "<GUEST_TOKEN>"
  },
  "messages": [
    {
      "id": 456,
      "sender": "student",
      "sender_name": "Example User",
      "text": "I need help signing in.",
      "created_at": "2026-10-04T10:20:00+00:00",
      "is_read": false
    }
  ]
}
```

These are illustrative values, not real user data or credentials.

### Field semantics

- `conversation.id`: server-issued integer thread ID.
- `conversation.status`: `open` or `resolved`.
- `message.id`: PostgreSQL message ID. This is the deduplication key and REST cursor source.
- `sender`: `student` for the user, including guests; `admin` for a team reply.
- `sender_name`: team member/profile display name.
- `text`: plain Unicode text, including line breaks.
- `created_at`: server timestamp; display in the device's locale/time zone.
- `is_read`: present in the contract, but not a reliable end-user read-receipt protocol.
- `context`: optional JSON metadata. The existing web widget sends `null`.

Do not execute HTML from message text. Do not apply AI answer rendering or mathematical answer features to support messages by default.

## 7. REST endpoint contract

All successful operations below currently return HTTP 200.

| Operation | Method and path | Authorization |
|---|---|---|
| Create guest thread | `POST /support/conversation` | No JWT required |
| Create user thread | `POST /support/conversation/auth` | EDUwAI JWT |
| Fetch guest messages | `GET /support/conversation/{id}` | `anonymous_token` query parameter |
| Fetch user messages | `GET /support/conversation/auth/{id}` | EDUwAI JWT |
| Send guest message | `POST /support/conversation/{id}/message` | `guest_token` JSON field |
| Send user message | `POST /support/conversation/auth/{id}/message` | EDUwAI JWT |
| Register guest push device | `POST /support/fcm-token` | `anonymous_token` JSON field when bound to a guest conversation |
| Register user push device | `POST /support/fcm-token/auth` | EDUwAI JWT |

### 7.1 Create guest conversation

```http
POST /support/conversation
```

```json
{
  "type": "support",
  "guest_name": "Example User",
  "guest_email": "user@example.com",
  "guest_phone": null,
  "context": null,
  "initial_message": "I need help signing in."
}
```

Use the creation response from section 6. An Authorization header does not change this route into the authenticated flow: the current implementation creates a guest conversation. Use the `/auth` creation route for a signed-in user.

### 7.2 Create authenticated conversation

```http
POST /support/conversation/auth
Authorization: Bearer <EDUWAI_ACCESS_TOKEN>
```

```json
{
  "type": "support",
  "context": null,
  "initial_message": "I have a question about my account."
}
```

The response has the same shape as guest creation, but `anonymous_token` is `null`. Do not supply guest identity fields to impersonate a different account.

### 7.3 Fetch guest conversation

```http
GET /support/conversation/123?since_id=0&anonymous_token=<URL_ENCODED_GUEST_TOKEN>
```

### 7.4 Fetch authenticated conversation

```http
GET /support/conversation/auth/123?since_id=0
Authorization: Bearer <EDUWAI_ACCESS_TOKEN>
```

Both fetch routes return `conversation` and `messages`.

#### Cursor and pagination rules

- `since_id` is optional and defaults to `0`.
- Messages satisfy `id > since_id`.
- Results are ordered by message ID ascending.
- Each response returns at most **100 messages**.
- This is a per-response cap, not a total conversation-history cap.
- There is no `has_more` field, latest-first mode, or `before_id` pagination contract.

Initial history loading:

1. Start with `since_id=0`, unless a complete local history cache and its matching cursor are available.
2. Merge each batch by numeric server message ID.
3. Advance the cursor to the greatest accepted message ID.
4. If a batch contains exactly 100 messages, request another batch.
5. Stop draining when the batch contains fewer than 100 messages.
6. Use that cursor for subsequent incremental updates.

If the local message cache is empty, do not reuse a persisted high cursor and thereby hide the earlier thread.

**Read side effect:** Both thread-fetch routes reset the conversation's `unread_student` counter. Do not poll these routes invisibly from a closed/background chat solely to calculate a badge. Their metadata is read before the reset, and message-level `is_read` is not updated by this operation.

### 7.5 Send guest message

```http
POST /support/conversation/123/message
```

```json
{
  "text": "I am still unable to sign in.",
  "guest_token": "<GUEST_TOKEN>"
}
```

### 7.6 Send authenticated message

```http
POST /support/conversation/auth/123/message
Authorization: Bearer <EDUWAI_ACCESS_TOKEN>
```

```json
{
  "text": "Thank you. I will try that."
}
```

Send success response:

```json
{
  "success": true
}
```

**Do not invent fields:** The send response does not return the saved message ID, a complete message object, an idempotency key, or delivery/read receipts. Fetch or listen for the saved message afterward.

### 7.7 Context metadata

The creation schema accepts an optional dictionary. A mobile client may use agreed metadata such as:

```json
{
  "surface": "mobile_home",
  "platform": "android",
  "app_version": "1.0.0"
}
```

These are proposed client metadata keys, not required existing fields. The existing widget sends `context: null`. Do not put credentials, complete device identifiers, or unnecessary personal data in this dictionary.

## 8. Message synchronization and send reliability

### REST-first foreground mode

- Fetch the thread immediately on opening.
- Poll for new messages every **4 seconds**, matching the current web interval.
- Poll only while the app is foregrounded and the thread screen is open.
- Prevent overlapping polls.
- Retain draft text when a request fails.
- Back off on repeated transport/server failures, and fetch immediately after connectivity returns.
- Use a finite HTTP timeout; for example, 20 seconds is a mobile implementation choice, not a server SLA.
- Stop the timer when the screen closes, the app backgrounds, or identity changes.

### Outgoing message states

Use local states such as:

```text
draft -> sending -> sent-awaiting-echo -> confirmed
                         |
                         +-- REST/Firestore reconciliation supplies server message ID

sending -> failed or delivery-uncertain
```

- Prevent double tapping Send and concurrent conversation-creation requests.
- Assign a temporary local UI ID to an outgoing bubble.
- Do not use that temporary ID as `since_id`.
- After REST success, label the message **Sent**, not **Read** or **Delivered**.
- Reconcile the temporary bubble with the server echo without adding two copies.
- Since the API has no correlation/message ID in its acknowledgement, serialize outgoing submissions during reconciliation or use a carefully bounded pending-echo matching strategy.
- Deduplicate real messages using numeric server IDs, not text equality.

### Retry safety

The API has no idempotent create/send contract. A timeout may mean the server saved the request but its response was lost.

- Retry safe reads with backoff.
- Refresh an expired JWT once when appropriate.
- Do not automatically resubmit a timed-out create/send POST.
- For an existing thread, reconcile new messages before offering a manual retry.
- Preserve a clear **Checking delivery** or **Delivery uncertain** state when the outcome is unknown.
- A first creation request whose response is lost is particularly limited: the client may never receive its new conversation ID/guest token, and there is no student-side list/search API to recover it.

Do not promise exactly-once messaging with the current contract.

## 9. Optional Firestore real-time mode

The existing create endpoints may return a Firebase custom token. It is distinct from the EDUwAI JWT and guest token.

### Setup

1. Configure the mobile client against the existing EDUwAI Firebase project using appropriate platform client configuration.
2. After creation, require all of:
   - `firebase_available == true`;
   - a nonempty `firebase_token`;
   - successful Firebase custom-token sign-in;
   - a successfully attached listener.
3. Subscribe to:

```text
support_conversations/{conversationId}/messages
```

The current web listener orders by `created_at` ascending.

The backend-issued custom token currently uses:

```text
uid: support_student_{conversationId}
claims:
  role: student
  conversation_id: {conversationId}
```

These are server-issued identities. Do not construct or mint tokens on the device.

### Correct client behavior

- Send every message through REST, even when Firestore is enabled.
- Bootstrap history from REST and merge Firestore events into it.
- Do not replace the full REST thread with an empty or incomplete Firestore snapshot.
- Firestore documents use generated document IDs; their stored numeric `id` is the canonical PostgreSQL message ID.
- Deduplicate by that numeric field, including across repeated/mirrored snapshots.
- Use server message ID ordering for the canonical thread. Firestore `created_at` reflects synchronization time and can differ from PostgreSQL's original message timestamp.
- Convert Firebase Timestamp objects for display.
- Do not advance a REST cursor using a Firestore document ID.
- On listener errors, failed sign-in, missing configuration, or missing token, fall back to REST polling visibly rather than silently freezing the conversation.

### Status and restored-session limitations

- Message snapshots alone do not tell the client that a conversation has been resolved.
- Use REST metadata and, where permitted, a listener on `support_conversations/{conversationId}` for status updates.
- If relying on a message listener, perform a periodic REST status reconciliation while the screen is open; a 30-second status check is a recommended client policy.
- The create endpoint is currently the student-facing source of a fresh Firebase custom token.
- There is no separate student support Firebase-token reissue endpoint in the current router.
- On restoration, reuse a valid SDK-managed Firebase session only if it matches the conversation; otherwise use REST polling. Do not create another ticket merely to obtain a Firebase token.
- Never call the admin Firebase-token endpoint from the student app.

If the app uses Firebase Auth elsewhere, isolate support auth in an appropriate separate Firebase app/auth instance so signing in with a conversation-scoped token does not overwrite another feature's identity.

**Security prerequisite:** Verify the deployed Firestore rules limit reads to the authorized conversation and disallow student client writes. No Firestore security-rules file was found in the inspected workspace, and live rules were not independently verified. Do not infer rule correctness merely from the token claims.

## 10. Background notifications and FCM registration

The existing admin-reply API saves the reply and asks the server's Firebase Admin integration to send an FCM notification to registered devices.

The mobile project integrates a client SDK and registers its device token; it does not implement a notification-sending backend.

### Guest device registration

```http
POST /support/fcm-token
```

```json
{
  "fcm_token": "<NATIVE_FCM_DEVICE_TOKEN>",
  "platform": "android",
  "conversation_id": 123,
  "anonymous_token": "<GUEST_TOKEN>"
}
```

The backend verifies that the guest token owns the conversation. Do not use this route to bind an authenticated user's conversation.

### Authenticated device registration

```http
POST /support/fcm-token/auth
Authorization: Bearer <EDUWAI_ACCESS_TOKEN>
```

```json
{
  "fcm_token": "<NATIVE_FCM_DEVICE_TOKEN>",
  "platform": "ios",
  "conversation_id": 123
}
```

The backend checks that the conversation belongs to the JWT user.

Both responses:

```json
{
  "success": true
}
```

Use `android` or `ios` as the client platform convention; the current API schema stores a string, rather than validating a platform enum.

Register after a thread is created/restored and after FCM token changes. Both routes allow registration without a conversation ID, but a guest registration must later be bound to its actual conversation to receive that thread's replies.

### Notification payload

The current server sends a notification title and body, with data shaped as:

```json
{
  "conversation_id": "123",
  "type": "support_reply"
}
```

- Title: `EDUwAI Support`.
- Body: team member name plus a shortened reply preview.
- Data values are strings.
- Android priority is high.
- The current APNs configuration uses default sound and a fixed badge of `1`; this is not an accurate multi-thread unread total.

### Native behavior

- Ask for notification permission at a relevant point; denied permission must not prevent chat use.
- Configure Android notification handling/channel behavior and iOS/APNs integration in the existing Firebase project as needed.
- An Expo push token is not an FCM registration token. Do not send `ExponentPushToken[...]` to these routes.
- In foreground, avoid showing duplicate alerts when the same reply is already visible in the open thread.
- When backgrounded or terminated, rely on platform notification delivery—not an indefinitely running JavaScript polling timer.
- On notification tap, validate `type`, parse the conversation ID, locate the matching saved identity/credentials, and open the authorized thread.
- Refresh its real messages through REST. Push previews are not authoritative history.
- If credentials are missing, show an appropriate sign-in/recovery path; do not bypass ownership checks.
- Notifications are best effort. Always reconcile on app resume, even if no push was received.

### Logout and shared-device privacy

There is no student FCM unregister endpoint in the current router. Local sign-out alone does not remove a registered server-side device binding.

Before production push release, implement and verify appropriate device-token invalidation/rotation through the mobile messaging SDK on logout/account switch, clear displayed notifications where appropriate, and re-register only for the new identity. If this cannot reliably prevent previous-account notifications, treat push privacy as an unresolved integration requirement rather than claiming logout unregisters the device.

## 11. Conversation screen UI

### Header

- Title: **EDUwAI Support**.
- Existing subtitle: **We typically reply within a few hours**.
- **New** action when a conversation exists.
- Close/back action.
- Resolved status when applicable.
- Optional **Live** transport indicator only for a functioning real-time connection; it must not imply a human agent is currently online.

### Thread

- User messages: right-aligned indigo bubble with white text.
- Team messages: left-aligned neutral bubble, with `sender_name` or **EDUwAI Team**.
- Show local timestamps and preserve line breaks.
- Use readable native text, wrapping long words/URLs safely.
- Scroll to recent messages on first load.
- Auto-scroll new messages only when the user is near the bottom; otherwise show a new-message affordance.
- Show loading, empty, reconnecting, failed-send, and resolved states explicitly.
- Preserve drafts across screen close when practical, within the correct identity.

### Composer

- Multiline text input and a send action.
- Empty/whitespace-only text cannot be sent.
- Disable duplicate submissions while sending/creating.
- Fit above the keyboard and safe area.
- Keep the draft visible or recoverable after failure.
- Do not add attachment, image, audio, typing-indicator, or read-receipt features without another supported contract. The current support send API is text-only.

The current support widget uses a light palette. A mobile dark-mode adaptation is a client design decision, not an existing backend capability.

## 12. Open, resolved, new, and deleted conversations

### Open

- Fetch and synchronize messages.
- Permit text sends.

### Resolved

- Show **Conversation resolved**.
- Disable the composer.
- Offer **Start a new conversation**.
- A send to a resolved conversation returns HTTP 400.
- Refetch status if the server rejects a send because resolution happened between the last poll and submission.

### Reopened by the team

The existing admin backend supports reopening. Update local status from every metadata response in both directions:

```text
isResolved = conversation.status == "resolved"
```

Do not permanently latch the client into a resolved state after its first resolved response.

### New

- Clear the selected local conversation pointer, messages, cursor, and real-time subscription.
- Preserve the old server conversation; New does not resolve or delete it.
- Guest: show the introduction form.
- Authenticated user: return to the empty composer and create lazily on the next send.
- Bind notifications to the new thread as appropriate.

### Deleted or inaccessible

- HTTP 404 means the selected conversation is missing.
- HTTP 403 means credentials do not authorize it, or the wrong guest/auth route was used.
- Stop the listener and do not keep polling an invalid pointer.
- Explain that this thread cannot be opened and allow starting an appropriate new one.
- Do not invent a student delete/reopen endpoint.

## 13. Authentication integration

Reuse the mobile project's existing EDUwAI authentication module.

Current backend capabilities relevant to an API-only native app:

- Phone/email OTP verification responses include `access_token`, `refresh_token`, and user/profile information.
- Authenticated support calls use the access token as a bearer JWT.
- `POST /auth/token/refresh` accepts a refresh cookie or a JSON `refresh_token`.
- `POST /auth/logout` also accepts the refresh cookie or JSON refresh token.
- The current code defines a 24-hour access-token lifetime and a 30-day initial refresh-token lifetime, with sliding refresh expiry. Do not hardcode these as future guarantees; use the token's expiry and server response.

Native refresh example:

```http
POST /auth/token/refresh
```

```json
{
  "refresh_token": "<EDUWAI_REFRESH_TOKEN>"
}
```

Response:

```json
{
  "access_token": "<NEW_EDUWAI_ACCESS_TOKEN>",
  "token_type": "bearer",
  "user": {
    "id": 42
  }
}
```

The actual user object includes additional profile/organization fields. The current refresh response does not promise a rotated refresh token; retain the stored one unless a replacement is explicitly returned.

Native logout:

```http
POST /auth/logout
```

```json
{
  "refresh_token": "<EDUWAI_REFRESH_TOKEN>"
}
```

### Client requirements

- Store refresh and guest tokens in Keychain/Keystore-backed secure storage.
- Keep access tokens in the application's secure authentication state.
- On 401, serialize refresh requests so several concurrent calls do not refresh at once.
- Retry the original request at most once after successful refresh.
- Do not loop refresh requests or treat every 403 as token expiry.
- On refresh failure, stop authenticated support activity and require sign-in again.
- Logout must clear local credentials and thread state as well as calling the backend.
- Keep EDUwAI access/refresh tokens, guest tokens, and Firebase custom/session tokens separate.

The web client uses an HTTP-only refresh cookie. The JSON fallback means a native client can use the existing APIs without depending on browser cookie behavior.

Google/browser login integration is a separate mobile-auth concern. Do not assume an OAuth redirect endpoint accepts an arbitrary native ID-token JSON body.

## 14. Local state and credential model

Suggested client-only state:

```text
SupportConversationState
  apiEnvironment
  ownerKind: guest | authenticated
  ownerUserId: optional
  conversationId: optional
  anonymousToken: optional, secure storage only
  status: unknown | open | resolved
  messages: server-ID keyed cache
  pendingMessages: local temporary-ID keyed queue
  lastFetchedServerMessageId
  lastSeenAdminMessageId
  draft
  transport: rest | firestore
  synchronizationState
```

These are mobile state fields, not extra API request fields.

Suggested namespaces:

```text
support:{environment}:guest
support:{environment}:user:{userId}
```

Only persist a high fetch cursor if its corresponding message history is also retained. Otherwise refetch from `0`.

Avoid storing unnecessary contact information or message history. If caching messages for offline display, protect them appropriately and isolate them across users. A cached thread is not proof that current credentials still authorize its server copy.

Never embed backend database credentials, service-account keys, JWT signing secrets, or AI provider keys in the app.

## 15. Mobile lifecycle and unread handling

### Foreground, thread visible

- Refresh the thread and current status.
- Start the chosen foreground synchronization transport.
- Update local seen state when replies are actually displayed.

### Foreground, thread closed

- Stop thread polling/listening.
- Keep the conversation pointer.
- Handle foreground FCM notifications to update a local unseen indicator.
- Do not call the message-fetch endpoint just to compute unread counts; it marks the thread read server-side.

### Background or terminated

- Stop foreground timers/listeners.
- Use OS notification handling.
- Persist enough identity-bound state to route a notification safely.
- Do not assume background JavaScript remains scheduled or that push always arrives.

### Resume

- Restore or refresh authentication.
- Reconcile authorized thread data when opening the chat.
- Treat push counters as hints, not the only source of messages.

### Badge limits

The current student API has no separate unread-count endpoint, and message `is_read` values do not constitute reliable read receipts. Use local seen IDs or a simple unseen dot; do not present a guaranteed cross-device/global unread count.

## 16. Error contract and user-facing behavior

| Condition | Expected handling |
|---|---|
| HTTP 400, empty text | Keep draft, explain that a message is required |
| HTTP 400, resolved thread | Refresh status, disable composer, offer New |
| HTTP 401 | Refresh JWT once for authenticated calls; otherwise sign in |
| HTTP 403 | Check identity/owner type and credentials; do not repeatedly retry |
| HTTP 404 | Clear invalid active pointer and offer a new thread |
| HTTP 422 | Parse validation details; check missing/wrong request fields |
| HTTP 5xx or transport failure | Keep draft/history; reconnect; do not silently lose messages |
| Non-JSON edge/gateway error | Show a connection error, not raw HTML or a token-expiry assumption |
| Firebase unavailable/error | Continue with REST polling |
| Notification permission denied | Keep foreground chat fully usable |

Backend errors generally use `detail`; validation errors can use an array. Normalize both forms rather than displaying `[object Object]`.

Guest credentials appear in a query string for GET and a JSON field for writes. Redact full request URLs, tokens, and sensitive message text from analytics, crash breadcrumbs, and network logs.

## 17. Known limitations and release acceptance

### Existing backend limitations — do not assume these features

- No student endpoint for listing all previous support conversations.
- No student conversation search, guest recovery, or guest-to-user conversion endpoint.
- No student conversation delete/resolve API.
- No fresh student support Firebase-token endpoint separate from creation.
- No send acknowledgement containing message ID or correlation ID.
- No create/send idempotency contract.
- No typing indicator, attachment protocol, or reliable read-receipt API.
- No student FCM unregister endpoint.
- No accurate global student unread-count endpoint.
- Guest contact requirements are primarily client UI policy.

The mobile app can implement the core flow using the existing contract. Any stronger guarantees needing backend changes must be explicitly scoped separately, not silently recreated in a new server.

### Acceptance checklist

- Home and login entry points open EDUwAI Support, not the AI tutor.
- Button does not overlap native navigation, safe areas, or keyboard UI.
- Guest name/contact validation and optional initial message work.
- Signed-in users do not see an unnecessary guest form.
- Opening a signed-in chat does not create an empty ticket.
- Initial message is saved only once on creation.
- Guest GET uses `anonymous_token`; guest send uses `guest_token`.
- Guest/authenticated IDs cannot be accessed with the other identity's credentials.
- Account switching never exposes the prior user's thread.
- A 250-message thread loads through 100/100/50 batches without truncation.
- New messages merge by server ID without REST/Firestore duplicates.
- Empty or delayed Firestore snapshots do not erase REST history.
- Missing/failed Firebase setup falls back to working REST chat.
- Closing/backgrounding stops polling, and resuming restores synchronization.
- A lost send response does not trigger blind automatic duplicate submission.
- Drafts and delivery-uncertain states survive network errors.
- Resolved conversations disable sending; admin reopening is honored.
- New starts a separate thread without pretending to delete the old one.
- Push tokens are native FCM tokens and are registered against the correct identity.
- Notification tap opens only an authorized thread.
- Denied notifications still permit foreground chat.
- Logout/account switching does not leak prior-account push notifications.
- JWT refresh is serialized and cannot loop.
- Logs contain no JWTs, guest tokens, Firebase custom tokens, or private message content.
- Real authenticated/guest send, Firestore authorization, and Android/iOS push delivery are validated in the mobile test environment before release.

## 18. Separate student AI-chat API boundary

If the mobile app also has an **AI Tutor / Ask a Question** home tile, keep it distinct from the support speech-bubble button.

The existing learning APIs include:

| Feature | Existing endpoint |
|---|---|
| Available classes | `GET /student/available-classes` |
| Available subjects | `GET /student/available-subjects?class_id={id}` |
| Available syllabus documents | `GET /documents?class_id={id}&subject={encodedSubject}` |
| Syllabus answer, JSON | `POST /query` |
| Syllabus answer, streaming | `POST /query/stream` |
| Syllabus question history | `GET /query-history/{documentId}` |
| Personal document list | `GET /phase2/documents` |
| Personal-document answer, JSON | `POST /phase2/documents/{documentId}/query` |
| Personal-document answer, streaming | `POST /phase2/documents/{documentId}/query/stream` |
| Personal-document question history | `GET /phase2/documents/{documentId}/query-history` |
| Extract a question from a photo | `POST /extract-question-from-image`, multipart field `image` |

Syllabus query example:

```json
{
  "document_id": 123,
  "question": "Explain the water cycle.",
  "mode": "retrieve"
}
```

Personal-document query example:

```json
{
  "question": "Explain the main idea in this material.",
  "mode": "retrieve"
}
```

The latter selects its document in the URL, not a support conversation ID.

The streaming query routes are **POST requests returning server-sent events**. They are not the support-chat polling/Firestore protocol. Typical event payloads contain:

```text
data: {"type":"token","content":"A portion of the answer"}

data: {"type":"done","answer":"Complete answer","sources":[]}
```

There are also error events and mode/cache/source metadata. A full AI-learning handoff must cover the complete current event variants, answer rendering, quotas, sources, image retrieval, and the two learning modes; do not treat these abbreviated examples as the complete AI protocol.

The existing query request is document + question + mode. It is not a general multi-turn `messages[]` chat API. Showing question/answer bubbles in a native screen does not create server-side conversational memory.

Keep the two services separate:

```text
Human support:
  /support/conversation...
  persistent conversation IDs
  human team replies

AI learning:
  /query... or /phase2/documents/{id}/query...
  selected material and question requests
  generated answers, citations, and educational usage limits
```

## 19. Paste-ready brief for the mobile application project

> Implement the existing EDUwAI home-page Support chat as a native client feature. Do not create another backend or database. Use the production EDUwAI API base `https://api.eduwai.in/api` through environment configuration. Add the indigo floating support speech-bubble button, a guest introduction form, and an authenticated/guest conversation screen. Reuse EDUwAI JWT authentication and the existing refresh-token JSON fallback. Persist conversation credentials securely by user/guest and environment. Create authenticated conversations lazily on first Send; send the first text as `initial_message` only once. Use the exact guest/auth REST routes in this specification. Load and deduplicate paginated history using numeric message IDs and `since_id`. Poll every four seconds only while the thread is foregrounded and open, or use the existing conversation-scoped Firebase token for an optional Firestore listener with REST bootstrap/fallback. All writes remain REST. Integrate native FCM registration and authorized notification routing for background replies. Handle resolved/reopened status, uncertain delivery, safe retries, identity changes, and token privacy. Do not invent idempotency, read receipts, attachments, conversation-list, student delete/resolve, or FCM-unregister endpoints. Keep the human Support icon separate from AI Tutor query APIs.

## 20. Source references and validation boundary

Primary source files inspected:

- `src-frontend/components/ChatWidget.jsx`: icon, guest/auth phases, persistence, polling, send UI.
- `src-frontend/pages/LandingPage.jsx`: home-page support placement.
- `src-frontend/pages/Login.jsx` and `StudentPortal.jsx`: other support entry surfaces.
- `src-frontend/services/api.js` and `config.js`: API origin, bearer auth, refresh handling, tenant header.
- `src-frontend/services/firebase.js`: client configuration and custom-token sign-in.
- `src-frontend/hooks/useFirestoreMessages.js`: Firestore collection path and message mapping.
- `support_router.py`: request bodies, ownership checks, REST data, pagination, FCM registration, admin reply/resolve.
- `firebase_support.py`: conversation-scoped Firebase tokens, message mirroring, FCM/APNs payload.
- `auth_router.py` and `auth.py`: native-compatible refresh/logout bodies and token/session behavior.
- `main.py` and `phase2/routes.py`: separate educational query endpoints.

Live public OpenAPI inspection confirmed the support route names and create/send/FCM/refresh request fields. Public health responded successfully with a browser-identified request.

No real support ticket was created during preparation. Authenticated requests, native Firebase configuration, deployed Firestore rules, and device push delivery were not end-to-end tested. The specification documents the existing contract and the mobile verification work still required.

This is a documentation handoff only; it does not change application behavior or deploy a mobile app.