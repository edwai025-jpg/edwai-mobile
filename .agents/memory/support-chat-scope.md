---
name: Support chat scope
description: User's backend boundary and mobile support transport decision.
---

The user says mobile support chat must connect to the existing web application's API, not build a backend. This chat is human EDUwAI team support, not the student AI tutor.

**Why:** The user explicitly supplied the web application's integration specification and prohibited building another backend.

**How to apply:** Keep conversation ownership and persistence on the external EDUwAI service. Do not create local server routes, a replacement support database, or invented send/recovery endpoints.

Use REST as the initial foreground transport. Background push is a separate native integration, not a JavaScript timer or an Expo push token submitted to an FCM-token endpoint.

**Why:** The supplied contract allows REST-only operation while chat is open. Native FCM, APNs, and logout token privacy require configuration and verification before claiming background notifications work.

**How to apply:** Clearly distinguish foreground chat delivery from optional background notifications. Do not promise unread counts or exactly-once delivery beyond the external API's contract.

The user wants app-side native support-push code completed now and provider/build/physical-device testing deferred until later, potentially after publishing. Keep saveable instructions for resuming.

**Why:** The user asked to complete code-related changes now and test after publishing, fixing issues then.

**How to apply:** Preserve Expo Go foreground chat. Distinguish implemented code from native compilation and provider/device verification. A foreground-chat release may keep push off; do not enable public push or claim verified delivery/privacy before installed Android/iOS acceptance passes.