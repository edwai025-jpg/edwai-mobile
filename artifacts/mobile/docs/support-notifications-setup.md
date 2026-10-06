# EDUwAI support notifications: saved setup and release checklist

## Current status

This is preparation, not an enabled notification feature. Foreground support chat continues to use the existing EDUwAI web API. No replacement backend, support database, or sender has been added.

The supplied Android and iOS client files match Firebase project `edwai-prod-70474` and package/bundle identifier `com.edwai.app`. They are saved under `artifacts/mobile/firebase/` and referenced by the static `app.json`. Do not change the app identifiers.

Prepared code:

- `services/supportApi.ts`: `registerFcmToken` uses the existing guest/account registration endpoints, rejects Expo push tokens, and requires a saved thread with matching owner kind.
- `services/supportNotification.ts`: strict `support_reply` payload parsing and REST authorization of a matching saved pointer. These helpers are NOT connected to notification listeners or UI.
- `firebase.json`: future Firebase Messaging auto-initialization and iOS automatic remote-message registration default to off. This file only takes effect once a compatible native Firebase SDK is installed.
- Contract tests verify request shapes, rejected payloads/credentials, and REST authorization using controlled responses. They do not prove native token validity, delivery, or account isolation on devices.

Still required: native SDK integration, optional notification UI/permissions, token refresh registration, notification tap/resume wiring, logout token invalidation, APNs setup, native build verification, and physical Android/iOS acceptance testing.

## 1. What you can test now in Expo Go

Open the project in Replit's Preview panel, choose Open in Expo Go / Preview on your phone, and scan its QR code.

Test the existing foreground support experience:

1. Open EDUwAI Support as a guest; create a conversation and send a message.
2. Have the support team reply through the existing web support interface.
3. Confirm the reply appears while chat is open.
4. Close/reopen chat and background/resume the app, then open chat and confirm REST reloads the latest messages.
5. Test signed-in support, sign-out/account isolation, network failure, and resolved conversations.

Expo Go cannot load React Native Firebase's native messaging modules. It cannot verify this app's native FCM token or closed-app support notifications. An iOS native device token from expo-notifications is an APNs token, not an FCM registration token; neither that token nor an Expo push token may be sent to the support FCM endpoints.

You do not need a public store release to test push. You do need an installed native build containing the SDK and correctly signed/configured for each platform.

## 2. Prepare Apple/Firebase APNs configuration

Do this later in your own provider consoles. Never paste private keys into chat or put them in the mobile app/repository.

1. Ensure your Apple Developer account has the App ID `com.edwai.app` and Push Notifications enabled for it.
2. Create or locate an APNs authentication key in Apple Developer > Certificates, Identifiers & Profiles > Keys. Record its Key ID and your Team ID securely.
3. Open the existing Firebase project `edwai-prod-70474` > Project settings > Cloud Messaging > the iOS app.
4. Upload the APNs authentication key (`.p8`) directly to Firebase and enter the Key ID and Team ID there. A `.plist` alone does not configure APNs.
5. Confirm the iOS Firebase app uses `com.edwai.app`. Refresh the client config if provider settings require it.
6. Ensure the installed iOS build's signing profile includes the push entitlement. Development and distribution builds need the appropriate `aps-environment`; do not assume one fixed value fits every build.

No Firebase Admin service-account key belongs in the mobile application. Notification sending remains the existing web service's responsibility.

## 3. Complete the native SDK integration

This step needs an implementation pass, not just a Firebase console change.

The current project deliberately remains Expo Go compatible. Adding a native-only library changes that development requirement; confirm a supported native-build route and review the current Expo/Replit restrictions before installing it.

An FCM-capable option is React Native Firebase's app and messaging modules. Follow their current Expo instructions and choose versions compatible with this project's Expo/React Native versions. Do not use Firebase's JavaScript web SDK as a native FCM replacement.

The future integration must:

- Keep `app.json` static and retain its existing client configuration paths.
- Add the modules' required Expo config plugins and any compatible iOS build-properties configuration. Follow documentation for the chosen SDK version; do not copy outdated static-framework settings into a version using Swift Package Manager by default.
- Add Android `POST_NOTIFICATIONS` configuration and runtime permission handling for Android 13+.
- Add iOS push entitlements and remote-notification background mode as required by the chosen SDK/build.
- Set up an Android support notification channel before registration. Verify which channel the unchanged server payload actually uses; merely creating a channel does not make the server target it.
- Keep messaging auto-initialization disabled by default.
- Guard native code so Expo Go and web never import/invoke unavailable native modules. Continue providing REST chat there without errors.
- Obtain tokens only from native Firebase Messaging. On iOS, confirm successful APNs registration/mapping before requesting an FCM token.
- Handle SDK/version-specific permission APIs; current documentation recommends a permissions library or expo-notifications rather than relying on deprecated messaging permission helpers.
- Register after a saved thread is restored/created and on FCM token refresh, only after explicit opt-in and authorization checks.

For iOS distribution, use Replit's supported Publish/TestFlight flow after reviewing the native build. Replit's documentation currently says Google Play publishing and EAS CLI/EAS Build are not supported on Replit. Arrange a supported Android native-build route separately; do not attempt EAS commands in this workspace. Store submission is not part of this preparation.

## 4. Optional permissions and identity-bound registration

Add an explicit Enable support notifications action, initially off. Denial must never stop foreground chat. If the OS will no longer ask, offer Open Settings with a safe native-only handler.

Guest registration: `POST /support/fcm-token` with `fcm_token`, `platform`, `conversation_id`, and that guest conversation's `anonymous_token`.

Account registration: `POST /support/fcm-token/auth` with the EDUwAI bearer JWT and `fcm_token`, `platform`, `conversation_id`. Never add guest credentials to an account registration.

Use `supportApi.registerFcmToken` only with a token obtained from the native Firebase SDK. Its rejection of known wrong token formats cannot establish a token's provenance.

Wait for auth restoration before deciding whether the current identity is guest or signed in. Serialize token registration and identity transitions. Check a session generation before and after async work so a stale account's request cannot register after logout/new login. Never log token values, guest URLs, or reply contents.

## 5. Wire notification taps and resume safely

The server payload is `{"type":"support_reply","conversation_id":"123"}`. Titles and reply previews are not trusted history.

1. Handle both warm notification opens and cold-start/terminated notification opens using the chosen SDK's APIs.
2. Queue a tap until secure storage and authentication restoration finish.
3. Use only the active identity's saved support pointer, in the current API environment. Never search other accounts' or guest credentials to satisfy a notification ID.
4. Call `authorizeSupportReply` for that pointer. Ignored payloads do nothing. Recovery means show a sign-in/thread-unavailable explanation; do not create a ticket automatically.
5. After REST authorization, recheck the session generation and open the thread through the existing support widget/hook. Let its existing pagination load authoritative history. Do not insert previews as messages or display results returned for an old session.
6. HTTP 401 requires the existing single refresh retry/sign-in flow. HTTP 403/404 means unavailable, not an excuse to try another identity.
7. The current app retains one selected pointer per identity. A notification for an older thread discarded by New cannot safely be recovered from the supplied API, which has no student thread-list/recovery endpoint.
8. Reconcile REST when the thread opens or the app resumes with chat visible, even without a push. Do not fetch a closed thread merely to calculate unread counts: the API marks messages read.
9. In foreground, suppress duplicate alerts for replies already visible in the open thread. Treat the server's fixed iOS badge of 1 as a hint, not an accurate unread total.

No background JavaScript polling timer substitutes for native delivery.

## 6. Logout and shared-device privacy: release blocker

The existing API has NO FCM unregister endpoint. Local logout does not remove the server's token binding.

Before enabling push, implement and test a serialized shutdown sequence for logout, account changes, guest-to-account transitions, permission revocation, and turning notifications off:

1. Block new token registration; detach listeners and invalidate the current session generation.
2. Disable messaging auto-initialization to avoid immediately recreating a token.
3. Invalidate the native FCM token through the installed SDK (`deleteToken` or its supported equivalent). Where required, unregister iOS remote messages as well. Confirm the behavior for the actual SDK version, rather than assuming it.
4. Clear delivered notifications and badges where supported. Clearing a tray notification alone does not stop future delivery.
5. Clear prior-account thread state and credentials; retain a secure pending-invalidation marker if cleanup failed.
6. Do not register for another identity until invalidation succeeds and a new token is verified not to reuse the old binding. Require new identity-scoped opt-in.

Do not promise that an SDK success response alone proves all queued notifications are suppressed. Test delayed/in-flight replies and offline logout on a shared physical device. If the old account's preview can still appear, keep push off and report the unresolved privacy issue. A local tap-authorization check cannot hide a leaked OS notification preview.

If the current service cannot satisfy this privacy requirement with verified SDK invalidation, pause release and discuss the limitation explicitly; do not add an invented unregister route or replacement backend.

## 7. Physical Android/iOS acceptance checklist

Record results separately for Android and iOS, including native build version, OS version, environment, guest/account identity, delivery/tap result, and logout result. Do not record credentials or private messages.

- Confirm real-device HTTPS access to the existing API with guest and account credentials.
- Confirm the token is obtained from Firebase Messaging and belongs to the intended project.
- Register the saved thread and have a team member reply from the real support interface.
- Test chat visible, chat closed, app backgrounded, and app terminated normally.
- Tap notifications from background and cold start; verify the right authorized thread and complete REST history.
- Test malformed/unrelated payloads, missing saved credentials, older discarded threads, 401 refresh, and 403/404.
- Deny permission and turn it off in Settings; confirm foreground chat remains usable.
- Test permission re-enable and SDK token rotation/re-registration.
- Test account A logout then guest/account B on the same device. Send fresh and delayed replies to A: no A preview may appear and no A thread may open.
- Test guest-to-account transition and offline logout/invalidation failure; do not allow unsafe re-registration.
- Clear delivered notifications on logout; verify iOS badge handling and Android channel/sound behavior.
- Test guest and authenticated support separately on both platforms.

Only enable native push after all privacy-critical checks pass. Delivery is still best effort; REST reconciliation remains required.

## 8. Resume later

Ask: "Continue native support notifications using the saved setup guide. Keep the existing web API only. Complete the native Firebase SDK, optional permissions UI, token lifecycle/logout privacy, and authorized tap handling. Verify Android/iOS devices before enabling push."

Guide in the project: `artifacts/mobile/docs/support-notifications-setup.md`.

Preparation checks:

```sh
cd artifacts/mobile
node --test scripts/support-api.test.cjs scripts/support-push.test.cjs scripts/firebase-config.test.cjs
pnpm run typecheck
```

These checks use controlled responses; successful results are not a claim of production API access or native delivery.

Sources:

- https://rnfirebase.io/#installation-for-expo-projects
- https://rnfirebase.io/messaging/usage
- https://firebase.google.com/docs/cloud-messaging/ios/client
- https://docs.replit.com/features/artifact-types/building-mobile-apps
- Supplied support integration specification, sections 10, 13, 14 and 15.
