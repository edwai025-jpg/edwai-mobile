---
name: Mobile SDK runtime boundaries
description: Preserve other artifacts' React versions and avoid desktop tooling in the hosted Expo server.
---

Keep SDK-selected React versions local to mobile instead of changing the shared React catalog to satisfy an Expo upgrade. Shared workspace clients consumed by mobile must resolve React and React Query against the mobile app's own peer context.

**Why:** Other artifacts still use a different React release. A directly linked shared client can retain the shared release, producing duplicate React runtimes even after all mobile dependencies have been aligned. Injecting the client into the mobile dependency context resolved Expo Doctor's duplicate-runtime failure without upgrading unrelated artifacts.

**How to apply:** After SDK alignment, check shared clients as well as direct mobile dependencies. If an injected workspace client's generated sources gain files, synchronize the workspace installation before testing so its installed copy includes them.

Use Expo's supported `EXPO_UNSTABLE_HEADLESS=1` setting in the development environment for this hosted server.

**Why:** SDK 57's React Native DevTools tries to prepare a desktop executable by default; the hosted Linux environment lacks its GUI libraries. Expo's headless setting disables that desktop-only preparation without disabling the Expo Go server, web preview, or managed account sign-in.

**How to apply:** When SDK upgrades produce desktop DevTools startup errors, verify the SDK's supported headless switch rather than installing a desktop GUI stack or treating those errors as an Expo Go client failure.
