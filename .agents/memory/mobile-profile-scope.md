---
name: Mobile Profile scope
description: User-approved scope for aligning the separate mobile Profile tab with the web APIs.
---

Fix API and behavior gaps while preserving the separate Profile tab and its existing mobile layout. Do not copy web navigation, invent a settings API, or add native payment integrations as part of this alignment.

**Why:** The user separated Profile review from banner-only work and approved API/behavior fixes with the existing layout preserved.

**How to apply:** Treat visual redesigns, new settings capabilities and native checkout as separate requests. Verify external request contracts before changing callers; do not infer institution-managed account flags from unrelated roles.
