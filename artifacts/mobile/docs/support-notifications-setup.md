# EDUwAI support notifications: saved setup and release checklist

## Current status

The app-side notification code is implemented, but native delivery is NOT enabled or verified. The user chose to defer provider/build/device testing. Foreground support chat continues to use the existing EDUwAI web API. No replacement backend, support database, or sender has been added.

The supplied Android and iOS client files match Firebase project `edwai-prod-70474` and package/bundle identifier `com.edwai.app`. They are saved under `artifacts/mobile/firebase/` and referenced by the static `app.json`. Do not change the app identifiers.

Implemented code:

- `services/supportApi.ts`: `registerFcmToken` uses the existing guest/account registration endpoints, rejects Expo push tokens, and requires a saved thread with matching owner kind.
- `services/supportNotification.ts`: strict `support_reply` payload parsing and REST authorization of a matching saved pointer, now connected to the native lifecycle and existing support widget.
- `services/nativeSupportPush.ts` and `index.ts`: guarded React Native Firebase 26.4.0 messaging, Expo permissions/channel, foreground/warm/cold callbacks, and a lightweight background handler that never polls REST.
- `services/supportPushManager.ts`: serialized registration, identity changes, token refresh, generation-checked navigation, explicit opt-in, permission-revocation handling, and secure pending-cleanup/retired-token state.
- `components/support/SupportNotificationControls.tsx`: the chat header's bell opens optional enable/off, retry-cleanup/registration, and native-only Settings controls. Errors never block foreground chat.
- `context/auth.tsx` and the support host/hook: wait for auth restoration, suspend old push work before credentials change, discard prior-identity thread/draft state, and require opt-in for a new selected conversation.
- `firebase.json`: messaging auto-initialization and automatic iOS remote-message registration default to off; foreground system presentation is suppressed in favor of identity-checked generic local alerts.
- Contract/lifecycle tests verify code with controlled responses and SDK adapters. They do not prove native token validity, delivery, or shared-device isolation.

Still required: APNs/provider configuration, correctly signed native build compilation/installation, and physical Android/iOS acceptance testing, especially delayed replies/offline logout. Expo config introspection succeeds; that is not native compilation.

### Release gate

`EXPO_PUBLIC_SUPPORT_PUSH_ENABLED` is deliberately unset/off by default. No permission requests, token acquisition, new FCM registration, or native listeners run in an ordinary gated-off build. Existing pending device cleanup, if any, must still be processed.

To test later, set the public build flag to the literal `true` only for a signed private test build using the approved environment-variable flow, then rebuild. Never send an Expo/APNs token to the FCM endpoints. Do not enable public push until the privacy matrix below passes. A release with push kept OFF can continue offering foreground support chat; it does not constitute a release of verified notifications.

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

## 3. Native SDK code: implemented; native build verification deferred

The implementation pass is complete. Both Firebase modules are installed at 26.4.0; Expo notification/device/build-properties packages use the Expo 54-compatible versions.

Guarded imports keep web and Expo Go usable for foreground chat. Only a custom installed native build can exercise the Firebase messaging code.

The app uses React Native Firebase, not its JavaScript web SDK or Expo push tokens. This SDK version uses the New Architecture/TurboModules and iOS Swift Package Manager with dynamic frameworks. Review its current Xcode/Swift requirements and the native builder image before building. Do not replace these with older static-framework instructions without a deliberate SDK migration.

Implemented in code (verify the resulting installed builds later):

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

The explicit Enable support notifications action is initially off. Denial never stops foreground chat. Native Settings is offered alongside the permission controls. With the release gate off or in web/Expo Go, the panel explains why notifications are unavailable instead of pretending to register.

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

The serialized shutdown sequence is implemented. Before enabling public push, verify it on devices for logout, account changes, guest-to-account transitions, permission revocation, and turning notifications off:

1. Block new token registration; detach listeners and invalidate the current session generation.
2. Disable messaging auto-initialization to avoid immediately recreating a token.
3. Invalidate the native FCM token through the installed SDK (`deleteToken` or its supported equivalent). Where required, unregister iOS remote messages as well. Confirm the behavior for the actual SDK version, rather than assuming it.
4. Clear delivered notifications and badges where supported. Clearing a tray notification alone does not stop future delivery.
5. Clear prior-account thread state and credentials; retain a secure pending-invalidation marker if cleanup failed.
6. Do not register for another identity until invalidation succeeds and a new token is verified not to reuse the old binding. Require new identity-scoped opt-in.

Token deletion and tray cleanup are attempted independently: an offline token-deletion failure still attempts to dismiss delivered notifications and reset badges, while retaining the secure cleanup blocker. Registration does not resume automatically for the next identity. Native deletion may depend on connectivity; this is precisely why physical privacy checks remain a release gate.

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

Ask: "Continue support-notification provider and device verification using the saved setup guide. The app-side SDK, controls, lifecycle and tap code are implemented, but push is off. Finish APNs/signing and native build checks, then test privately on Android/iOS. Keep the existing web API only and enable public push only after shared-device privacy passes."

Guide in the project: `artifacts/mobile/docs/support-notifications-setup.md`.

Preparation checks:

```sh
cd artifacts/mobile
node --test scripts/support-api.test.cjs scripts/support-push.test.cjs scripts/support-push-lifecycle.test.cjs scripts/firebase-config.test.cjs
pnpm run typecheck
```

These checks use controlled responses; successful results are not a claim of production API access or native delivery.

Expo config introspection also resolves the messaging plugins, `remote-notification` background mode, Android permission/channel settings, and an iOS development push entitlement. Check the final signed distribution build's entitlement separately. The current preview runs; its existing Expo package-compatibility warnings must be reviewed in the native-build preflight.

Sources:

- https://rnfirebase.io/#installation-for-expo-projects
- https://rnfirebase.io/messaging/usage
- https://firebase.google.com/docs/cloud-messaging/ios/client
- https://docs.replit.com/features/artifact-types/building-mobile-apps
- Supplied support integration specification, sections 10, 13, 14 and 15.
