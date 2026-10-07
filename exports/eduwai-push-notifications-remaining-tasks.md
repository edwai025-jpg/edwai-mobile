# EDUwAI — Support Push: Completed Code and Deferred Checks

**Current status:** App-side notification code is complete. Push remains OFF by default. Native compilation, provider configuration, signing and real-device behavior are not verified.

**Agreed approach:** Complete code now; do provider/build/device testing later. A release with push disabled can retain foreground support chat. Publishing alone does not prove push works, and a public store release is not required for private device testing.

**Scope:** Use only the existing EDUwAI human-support web API. Do not add another backend, support database, notification sender, authentication system, or invented unregister endpoint.

## 1. Completed code — do not implement again

- [x] Native Firebase app/messaging modules installed at 26.4.0 with Expo-compatible notification/device/build-properties packages.
- [x] Static Expo plugins, Android notification permission/channel, and iOS remote-notification configuration.
- [x] Preserve Firebase project `edwai-prod-70474` and Android/iOS identifier `com.edwai.app`.
- [x] Guard native imports so web and Expo Go retain foreground chat without native-module crashes.
- [x] Messaging auto-initialization and automatic iOS remote registration default to off.
- [x] Explicit optional Enable/Turn off controls, permission handling, Settings, registration retry and cleanup retry.
- [x] Wait for authentication and secure-storage restoration before selecting the support identity.
- [x] Acquire only native Firebase Messaging tokens; check APNs registration before requesting an iOS FCM token.
- [x] Register a saved conversation after opt-in; handle token refresh with session checks and serialized operations.
- [x] New conversation requires fresh opt-in and invalidates the prior binding.
- [x] Warm/cold notification taps authorize the current identity's saved pointer through REST before opening chat.
- [x] Recheck navigation validity at the widget, including account changes and choosing New.
- [x] Malformed payloads are ignored; missing/older/unavailable threads show recovery without creating a ticket.
- [x] Generic foreground alerts, suppression for open chat, REST reconciliation and badge cleanup.
- [x] Suspend old registration before auth credentials change; clear previous-identity thread/draft state.
- [x] Native token invalidation and iOS unregistration; attempt tray/badge cleanup even if token deletion fails.
- [x] Secure pending-cleanup markers and retired-token reuse checks block unsafe new-identity registration.
- [x] TypeScript check and automated API/config/payload/lifecycle checks pass using controlled responses.
- [x] Preview startup checked with push disabled. Native build compilation is a separate outstanding check.

These checkmarks mean **code implemented**, not physical-device acceptance passed.

## 2. Provider and native build work — deferred

- [ ] Verify Android/iOS Firebase app registration and current client configurations in the provider console. Saved files match the intended project/identifiers; app registration alone is not complete push setup.
- [ ] Enable Apple Push Notifications for `com.edwai.app`, configure an APNs key/certificate directly in Firebase, and verify signing entitlements.
- [ ] Choose supported native build/distribution routes for Android and iOS.
- [ ] Review Firebase 26's New Architecture, Swift Package Manager, dynamic-framework and Xcode/Swift requirements against the native builder.
- [ ] Review existing Expo dependency compatibility warnings before compiling the native builds.
- [ ] Compile correctly signed native builds and install them on physical Android/iOS phones.
- [ ] Verify the final distribution build's `aps-environment`, APNs mapping, Firebase SDK availability and genuine FCM tokens.
- [ ] Verify which Android channel the unchanged server payload uses and its sound/display behavior.

Use Replit's supported Publish/TestFlight flow for iOS after checking current documentation. Arrange a supported Android build route separately; do not run EAS commands in this workspace.

Keep APNs keys and signing credentials in approved provider/build credential storage, never in chat or this repository. Expo Go/browser preview cannot verify native Firebase delivery.

## 3. Existing registration contract — unchanged

API base: `https://api.eduwai.in/api`.

| Identity | Endpoint | Required authorization and fields |
|---|---|---|
| Guest | `POST /support/fcm-token` | `fcm_token`, `platform`, `conversation_id`, `anonymous_token` |
| Signed-in | `POST /support/fcm-token/auth` | Bearer access JWT; `fcm_token`, `platform`, `conversation_id` |

Platform is `android` or `ios`. Never submit an Expo push token or APNs token as an FCM token, and never mix guest credentials with account authorization.

Expected reply payload: `{"type":"support_reply","conversation_id":"123"}`.

## 4. Physical-device acceptance — all deferred

Test guests and signed-in users on both platforms. Have the EDUwAI team reply through the existing support interface. Record device/OS, build version, API environment and non-sensitive pass/fail evidence.

| Check | Android | iOS |
|---|---|---|
| Real HTTPS API access and genuine FCM token | Not tested | Not tested |
| Guest/account registration and token rotation | Not tested | Not tested |
| Visible chat receives replies without duplicate alerts | Not tested | Not tested |
| Closed chat, foreground app alert | Not tested | Not tested |
| Background and normally terminated app delivery | Not tested | Not tested |
| Background/cold-start tap opens only the authorized thread | Not tested | Not tested |
| Complete REST history without duplicate messages | Not tested | Not tested |
| Denial/revocation/re-enable keeps foreground chat usable | Not tested | Not tested |
| Malformed payload, missing credentials, discarded thread recovery | Not tested | Not tested |
| Expired JWT refresh and HTTP 403/404 recovery | Not tested | Not tested |
| Account A logout/switch prevents all old-account previews/navigation | Not tested | Not tested |
| Guest-to-account transition and offline cleanup failure | Not tested | Not tested |
| Delayed/in-flight old-account replies after switching identities | Not tested | Not tested |
| Delivered-notification cleanup, badges and channel/sound | Not tested | Not tested |

Normal termination and OS force-stop differ; record which was tested. Never record credentials or private reply text.

## 5. Release gate — keep public push off until privacy passes

`EXPO_PUBLIC_SUPPORT_PUSH_ENABLED` defaults to OFF. Set it to the literal `true` only for a signed private test build through the approved environment-variable flow, then rebuild.

The existing service has **no FCM unregister endpoint**. SDK token-deletion success does not prove queued OS notification previews are suppressed. If account A's preview can still appear after logout/switching to B, keep push disabled and document the blocker; do not replace the backend.

- [ ] Native builds and provider/signing checks complete.
- [ ] Both platforms pass the matrix, especially delayed replies and offline/shared-device privacy.
- [ ] Fix issues discovered in native builds or device tests.
- [ ] Enable public push only after privacy-critical checks pass.

Notification delivery remains best effort. Foreground REST chat remains available independently.

## 6. Saved guide and code checks

- Detailed guide: `artifacts/mobile/docs/support-notifications-setup.md`.
- Existing API specification: `attached_assets/mobile-support-chat-integration-spec_1791160752897.md`.
- Native adapter/lifecycle: `artifacts/mobile/services/nativeSupportPush.ts`, `supportPushManager.ts`, `supportPush.ts`, and `artifacts/mobile/index.ts`.
- API and authorization: `artifacts/mobile/services/supportApi.ts` and `supportNotification.ts`.
- Chat/UI: `artifacts/mobile/components/support/`, `hooks/useSupportChat.ts`, and `context/auth.tsx`.
- Native configuration: `artifacts/mobile/app.json`, `firebase.json`, and `firebase/`.

```sh
cd artifacts/mobile
node --test scripts/support-api.test.cjs scripts/support-push.test.cjs scripts/support-push-lifecycle.test.cjs scripts/firebase-config.test.cjs
pnpm run typecheck
```

Controlled-response checks and browser startup are not substitutes for native compilation or device testing.

## 7. Copy-and-paste request to resume later

> Continue the deferred support-notification provider/build/device checks using exports/eduwai-push-notifications-remaining-tasks.md and the saved setup guide. App-side SDK, controls, token lifecycle, authorized taps and logout cleanup are implemented; push remains off. Finish APNs/signing and native compilation, then test privately on physical Android/iOS devices. Preserve the existing EDUwAI web API and foreground chat. Enable public push only after shared-device privacy passes, and report unresolved blockers honestly.
