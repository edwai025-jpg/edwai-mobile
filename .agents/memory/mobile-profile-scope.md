---
name: Mobile Profile scope
description: User-approved scope for aligning the separate mobile Profile tab with the web APIs.
---

Fix API and behavior gaps while preserving the separate Profile tab and its existing mobile layout. Do not copy web navigation, invent a settings API, or add native payment integrations as part of this alignment.

**Why:** The user separated Profile review from banner-only work and approved API/behavior fixes with the existing layout preserved.

**How to apply:** Treat visual redesigns, new settings capabilities and native checkout as separate requests. Verify external request contracts before changing callers; do not infer institution-managed account flags from unrelated roles.

The Education/Academics and Account iteration must leave the remaining mobile Profile sections unchanged; the user reserved them for a second iteration.

**Why:** The user explicitly requested attribute entry and related functionality only in those two sections, with no change to the mobile Profile layout.

**How to apply:** Preserve the Profile page and its navigation. Refresh academic context when academic attributes change, but do not broaden the work to Payments, Settings, Security, deletion, or photo behavior.

Profile photo add, replace, crop, display, and removal are separately approved using the supplied photo handoff. Keep the current mobile Profile tab and UI; the web screenshot is a functional reference, not a redesign request.

**Why:** The user explicitly asked for seamless photo functionality from the Profile tab while keeping its current UI.

**How to apply:** Use the existing avatar/photo entry points, keep photo changes independent of unfinished Account/Education drafts, and leave the remaining Profile sections outside this work.

Do not show New Password or Confirm Password controls in the mobile Account editor. Use the web version's “Password login is disabled” notice explaining phone/email OTP login and support-assisted access instead.

**Why:** The user explicitly reversed the earlier password-control approval because there is no password login.

**How to apply:** Keep account saves free of password drafts/payloads and preserve existing contact verification. This is not permission to change authentication or enable password sign-in.
