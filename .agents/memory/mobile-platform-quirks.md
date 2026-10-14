---
name: Mobile platform quirks
description: Native modal hosting and Expo web confirmations, startup, text refs, and microphone cleanup.
---

Do not use sibling React Native modal hosts for an Account editor and its photo crop step on iOS. Reuse the currently visible host and change its content without closing the editor.

**Why:** Browser photo tests passed with multiple portals, but the user confirmed the iPhone returned from photo selection without ever showing Crop Photo. UIKit's native presentation rules differ from browser portals; no crop means the upload has not started.

**How to apply:** Preserve unsaved editor state when entering/leaving crop, keep Cancel free of mutations, and route system back to the crop's own busy-aware cancellation. Verify host ownership separately from HTTP encoding; browser upload success is not native presentation proof.

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

Expo 57 installs its own global fetch by default; native URI-only FormData parts are not compatible with its multipart encoder.

**Why:** A real-phone voice upload failed with `Unsupported FormDataPart implementation`. The installed Expo encoder explicitly rejects URI-only parts and accepts Blob or file-like values exposing readable bytes. Browser FormData tests did not exercise that encoder.

**How to apply:** Check the installed native transport before choosing a multipart representation. For Expo fetch, provide real file bytes with the intended MIME type and filename, and test serialization against the installed encoder rather than only asserting mocked FormData fields. Do not globally switch fetch transports to fix one caller.

For Expo bundle checks, discover the managed port and entry URL instead of assuming Metro's default port or the expo-router entry path.

**Why:** The managed server used a different port and a workspace-relative entry URL. The guessed URLs failed while the actual iOS and Android bundles compiled successfully.

**How to apply:** Read the running workflow's port and the served HTML script URL or launch manifest before requesting native bundles. Do not treat a guessed URL's 404 as a compilation failure.