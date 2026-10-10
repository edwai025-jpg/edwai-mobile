---
name: Expo browser confirmations
description: Expo web confirmations, startup snapshots, imperative text refs, and microphone cleanup.
---

Do not rely on React Native's `Alert.alert` to present confirmation actions in the Expo web preview. Use an in-app confirmation on web; native alerts remain appropriate on iOS and Android.

**Why:** Browser verification found that tapping a native-alert-backed action did nothing on web, leaving the protected action unreachable without an error.

**How to apply:** For cross-platform confirmations, verify the web branch actually exposes actionable confirm/cancel controls. Do not substitute browser `window.confirm`, which can be blocked inside preview iframes.

An Expo preview snapshot can capture a white frame before startup fonts settle even when the application works.

**Why:** Two snapshot captures were white with no errors, while a clean browser on the same Expo origin rendered the signed-out page with all fonts/assets loaded shortly afterward.

**How to apply:** Before treating a white snapshot as a broken app, verify the exact origin in a real browser and wait for visible content and `document.fonts.ready`. Do not repeatedly restart a working server or infer failure from the brief capture alone.

Native TextInput TypeScript methods are not proof that the Expo web ref exposes the same imperative API.

**Why:** The installed web renderer exposes a DOM text field without the native `setNativeProps` method, despite that method being valid in shared TextInput types.

**How to apply:** Keep selection controlled; use DOM selection methods on web and guarded native methods on phones. Verify ref-dependent actions in the browser, not just with TypeScript.

Do not assume the Expo browser recorder releases microphone tracks when its stop promise resolves.

**Why:** The inspected Expo 57 browser recorder finalizes its Blob on stop but leaves MediaStream cleanup for later lifecycle handling. A mounted composer must release the microphone immediately instead.

**How to apply:** Explicitly release all browser tracks on stop, cancellation, interruption, or late permission resolution. If replacing the browser adapter with an SDK recorder, recheck that installed version's cleanup semantics first.