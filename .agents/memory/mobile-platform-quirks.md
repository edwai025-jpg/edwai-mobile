---
name: Expo browser confirmations
description: Native-alert confirmations and font-gated startup snapshots in the Expo web preview.
---

Do not rely on React Native's `Alert.alert` to present confirmation actions in the Expo web preview. Use an in-app confirmation on web; native alerts remain appropriate on iOS and Android.

**Why:** Browser verification found that tapping a native-alert-backed action did nothing on web, leaving the protected action unreachable without an error.

**How to apply:** For cross-platform confirmations, verify the web branch actually exposes actionable confirm/cancel controls. Do not substitute browser `window.confirm`, which can be blocked inside preview iframes.

An Expo preview snapshot can capture a white frame before startup fonts settle even when the application works.

**Why:** Two snapshot captures were white with no errors, while a clean browser on the same Expo origin rendered the signed-out page with all fonts/assets loaded shortly afterward.

**How to apply:** Before treating a white snapshot as a broken app, verify the exact origin in a real browser and wait for visible content and `document.fonts.ready`. Do not repeatedly restart a working server or infer failure from the brief capture alone.