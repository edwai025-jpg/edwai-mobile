# EDUwAI — Remaining Support Push Notification Tasks

Use this checklist after app registration and notification-provider setup are complete.

**Scope:** Finish native Android and iOS notifications for human support chat using the existing EDUwAI web API. Do not build another backend, database, notification sender, or authentication system.

**Current status:** Foreground support chat works independently of push. Notification preparation has been merged, but native push is not enabled or verified.

**Terminology:** The request mentions “SDN.” Its meaning has not been confirmed. Before resuming, confirm whether this means the native SDK, APNs, or another service. Do not assume that app registration alone completes either SDK integration or Apple notification setup.

## 1. Already prepared — do not duplicate

- Android and iOS Firebase client configuration files are saved under `artifacts/mobile/firebase/` and referenced by `artifacts/mobile/app.json`.
- The configured Firebase project is `edwai-prod-70474`; the Android package and iOS bundle identifier are `com.edwai.app`. Preserve these identifiers unless a deliberate migration is approved.
- `artifacts/mobile/services/supportApi.ts` has `registerFcmToken` for the existing guest and signed-in registration endpoints.
- `artifacts/mobile/services/supportNotification.ts` has payload parsing and REST-based authorization helpers. They are not wired to native notification listeners or the chat UI.
- `artifacts/mobile/firebase.json` prepares messaging auto-initialization to default to off once the compatible native SDK is installed.
- Preparation tests check API contracts and payload handling using controlled responses. Passing them does not prove real-device delivery or logout privacy.
- The detailed setup guide is `artifacts/mobile/docs/support-notifications-setup.md`.

## 2. Prerequisites to confirm before implementation

Skip provider setup that has already been completed, but verify the resulting configuration in the installed build.

- [ ] Confirm what “SDN” refers to and record which setup steps are complete.
- [ ] Confirm Android and iOS are registered in the intended Firebase project with identifiers matching `com.edwai.app`.
- [ ] Confirm the saved client files are current and belong to the intended project.
- [ ] For iOS, confirm Apple Push Notifications are enabled for the App ID, an APNs key or supported certificate is configured in Firebase, and build signing includes the correct push entitlement.
- [ ] Agree on a supported native build and physical-device testing route for each platform.
- [ ] Confirm whether native Firebase app/messaging SDK modules have already been installed and included in the build. They are not currently dependencies in this project.

**Important:** Test native push in an installed build containing the messaging SDK, not Expo Go or the browser preview. Public store release is not required just to perform device testing. Keep private APNs keys and signing credentials in approved provider/build credential storage, never in chat or this repository.

## 3. Remaining implementation tasks — complete in order

### Task A — Complete and verify native messaging integration

- [ ] If not already completed, add compatible native Firebase app and messaging modules.
- [ ] Configure the required Expo plugins and platform build settings for the selected SDK version.
- [ ] Keep the existing static app configuration and Firebase client-file paths.
- [ ] Configure Android notification permission support and the support-notification channel.
- [ ] Verify which Android channel the existing server payload actually uses.
- [ ] Configure iOS push entitlements and any SDK-required background notification capabilities.
- [ ] Keep messaging auto-initialization off until the user opts in.
- [ ] Guard native messaging imports so web and Expo Go retain foreground chat without native-module crashes.
- [ ] Produce and install correctly configured Android and iOS test builds.
- [ ] Confirm iOS APNs registration and Firebase mapping before requesting its FCM token.

**Done when:** Both installed native builds obtain genuine Firebase Messaging tokens for the intended project. An Expo push token is not acceptable; an iOS APNs token is also not a substitute for an FCM token.

### Task B — Add optional notification controls

- [ ] Add an explicit “Enable support notifications” action, initially off.
- [ ] Request permission at a relevant point using APIs supported by the chosen SDK/platform.
- [ ] Handle granted, denied, and permanently denied permission states.
- [ ] Offer a safe native “Open Settings” action where permission cannot be requested again.
- [ ] Add an action to turn support notifications off.
- [ ] Keep notification preferences scoped to the current identity.
- [ ] Show registration errors honestly without blocking ordinary support chat.

**Done when:** Users can choose whether to enable notifications, and denied permission never prevents foreground messaging.

### Task C — Wire identity-safe token registration and refresh

- [ ] Wait for authentication and secure-storage restoration before selecting guest or account identity.
- [ ] Register only after opt-in and after a conversation has been created or restored and authorized.
- [ ] Use the existing API helper with a genuine native FCM token.
- [ ] Subscribe to FCM token changes and register the replacement token for the current authorized conversation.
- [ ] Handle a newly selected conversation after the user chooses “New.”
- [ ] Serialize registration and identity changes. Recheck the active session before and after asynchronous operations.
- [ ] Use the existing one-refresh/one-retry authentication behavior for HTTP 401; do not treat HTTP 403 as token expiry.
- [ ] Never log device tokens, guest credentials, credential-bearing URLs, or private reply text.

**Existing API contract:**

| Identity | Endpoint | Required authorization and fields |
|---|---|---|
| Guest | `POST /support/fcm-token` | `fcm_token`, `platform`, `conversation_id`, `anonymous_token` |
| Signed-in user | `POST /support/fcm-token/auth` | Bearer access JWT; `fcm_token`, `platform`, `conversation_id` |

The API base is `https://api.eduwai.in/api`. Use `android` or `ios` as the platform. Do not mix guest credentials and account authorization.

**Done when:** Real-device registration is confirmed for guest and signed-in conversations, including token refresh, without allowing stale-session registration.

### Task D — Connect notification taps to the correct support chat

- [ ] Handle notification opening while the app is running or backgrounded.
- [ ] Handle opening from a normally terminated app.
- [ ] Queue notification navigation until authentication and secure storage are ready.
- [ ] Accept only the expected payload: `type: "support_reply"` and a valid string `conversation_id`.
- [ ] Use only the active identity's saved conversation in the current API environment.
- [ ] Call the prepared REST authorization helper before displaying the thread.
- [ ] Recheck the session after authorization and before opening the chat.
- [ ] Wire the authorized result into the existing support host/widget so the right chat actually opens.
- [ ] Load full authoritative message history through the existing REST pagination.
- [ ] For missing credentials, a discarded older thread, or HTTP 403/404, show an appropriate recovery explanation instead of creating a new ticket.
- [ ] Never try another user's or a guest's credentials to satisfy a notification ID.

**Done when:** Background and cold-start taps open only the matching authorized thread. Push preview text is never inserted as a saved message.

### Task E — Handle foreground replies, resume, and badges

- [ ] Avoid duplicate notification alerts when the reply is already visible in the open support chat.
- [ ] Keep REST synchronization as the authoritative recovery path.
- [ ] Refresh an open chat on app resume even when no notification was received.
- [ ] Do not poll a closed chat solely to calculate an unread badge: the existing fetch endpoint resets unread state.
- [ ] Treat the server's fixed iOS badge of `1` as a hint, not an accurate unread count.
- [ ] Confirm Android channel, sound, and visible-notification behavior.

**Done when:** Open-chat replies do not produce redundant alerts, and resuming the app recovers current messages without relying on push delivery.

### Task F — Protect logout and shared-device privacy — release blocker

**The existing service has no FCM unregister endpoint. Local logout alone does not remove the server's device-token binding.**

- [ ] Implement a serialized notification shutdown for logout, account switching, guest-to-account transitions, disabling notifications, and permission revocation.
- [ ] Stop registration, detach listeners, and invalidate the old session generation.
- [ ] Disable messaging auto-initialization before deleting the token.
- [ ] Invalidate the old FCM token with the chosen SDK's supported API; perform any required iOS remote-message unregistration.
- [ ] Clear delivered notifications and badges where supported.
- [ ] Clear the previous identity's local thread state and credentials as appropriate.
- [ ] Keep a secure pending-cleanup marker if invalidation fails or the device is offline.
- [ ] Block registration for a new identity until invalidation succeeds and token reuse cannot preserve the old binding.
- [ ] Require new identity-scoped opt-in before re-registering.
- [ ] Test delayed/in-flight notifications and offline logout on shared physical devices.

**Done when:** Replies for account A cannot expose A's preview or open A's thread after logout or switching to guest/account B.

If SDK invalidation cannot reliably meet this requirement with the existing service, keep push disabled and document the blocker. Do not invent an unregister endpoint or another backend. Tap authorization alone cannot prevent an old-account preview appearing in the OS notification tray.

## 4. Real-device acceptance tests

Run separately on Android and iOS, for both guests and signed-in users. Have a team member send replies through the existing web support interface.

| Check | Android | iOS |
|---|---|---|
| Real HTTPS API access and genuine FCM token | Not tested | Not tested |
| Guest and signed-in token registration | Not tested | Not tested |
| Reply while chat is visible, without duplicate alerts | Not tested | Not tested |
| Reply while chat is closed but app is foregrounded | Not tested | Not tested |
| Reply while app is backgrounded | Not tested | Not tested |
| Reply after normal app termination | Not tested | Not tested |
| Background notification tap opens the authorized thread | Not tested | Not tested |
| Cold-start notification tap opens the authorized thread | Not tested | Not tested |
| Complete history loads without duplicated messages | Not tested | Not tested |
| Permission denial/revocation leaves foreground chat usable | Not tested | Not tested |
| Permission re-enable and token rotation work | Not tested | Not tested |
| Malformed payload, missing credentials, and old discarded thread handled safely | Not tested | Not tested |
| Expired access token and HTTP 403/404 recovery | Not tested | Not tested |
| Logout/account switch prevents old-account previews and navigation | Not tested | Not tested |
| Guest-to-account switch and offline cleanup failure handled safely | Not tested | Not tested |
| Notification tray and badge cleanup; expected channel/sound | Not tested | Not tested |

Record device/OS, native build version, API environment, identity type, pass/fail, and any non-sensitive evidence. Do not record credentials or private messages. Normal termination and OS force-stop are different; record which state was tested.

## 5. Release checks

- [ ] All implementation tasks above are complete.
- [ ] Both platforms pass the real-device matrix, especially shared-device privacy.
- [ ] Review current build and distribution documentation before arranging builds; do not assume a particular build tool is supported in this workspace.
- [ ] Run the existing preparation checks:

```sh
cd artifacts/mobile
node --test scripts/support-api.test.cjs scripts/support-push.test.cjs scripts/firebase-config.test.cjs
pnpm run typecheck
```

- [ ] Fix or explicitly document remaining build/type-check failures before release.
- [ ] Enable push only after privacy-critical acceptance checks pass.
- [ ] Document that notification delivery is best effort and foreground REST chat remains available independently.

Preparation checks and browser tests do not replace physical-device testing.

## 6. Files to use when resuming

- `artifacts/mobile/docs/support-notifications-setup.md` — detailed setup and release guide.
- `attached_assets/mobile-support-chat-integration-spec_1791160752897.md` — authoritative existing web API contract.
- `artifacts/mobile/services/supportApi.ts` — conversation and token-registration API calls.
- `artifacts/mobile/services/supportNotification.ts` — payload parsing and thread authorization.
- `artifacts/mobile/hooks/useSupportChat.ts` — foreground thread state and synchronization.
- `artifacts/mobile/components/support/SupportChatHost.tsx` and `SupportChatWidget.tsx` — entry button and conversation UI.
- `artifacts/mobile/context/auth.tsx` — existing login session, refresh, and logout integration.
- `artifacts/mobile/services/credentialStorage.ts` — secure credential persistence.
- `artifacts/mobile/app.json`, `firebase.json`, and `firebase/` — native app and Firebase configuration.

## 7. Copy-and-paste request to resume

> App registration and notification-provider setup are complete. Confirm exactly which native SDK and APNs steps are finished, then continue using exports/eduwai-push-notifications-remaining-tasks.md and the saved setup guide. Finish native Firebase Messaging, optional permission controls, identity-safe token registration/refresh, notification opening, and logout privacy. Use only the existing EDUwAI web API. Keep foreground chat working without push. Verify installed Android and iOS builds on physical devices before enabling notifications. Report any unresolved device, signing, SDK, or privacy blocker rather than claiming push is complete.
