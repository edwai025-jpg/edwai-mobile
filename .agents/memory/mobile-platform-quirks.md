---
name: Expo browser confirmations
description: Native alert confirmations cannot be assumed to work in the Expo web preview.
---

Do not rely on React Native's `Alert.alert` to present confirmation actions in the Expo web preview. Use an in-app confirmation on web; native alerts remain appropriate on iOS and Android.

**Why:** Browser verification found that tapping a native-alert-backed action did nothing on web, leaving the protected action unreachable without an error.

**How to apply:** For cross-platform confirmations, verify the web branch actually exposes actionable confirm/cancel controls. Do not substitute browser `window.confirm`, which can be blocked inside preview iframes.