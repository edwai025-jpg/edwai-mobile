---
name: Sources and AI Study Pages scope
description: User-specified UI/API-only boundary and generated-page presentation semantics from the web handoff.
---

The user asked to recalibrate Sources and AI Study Pages using the attached web-derived specifications: “just implement the UI and api calls to get the study pages but don't implement anything on own.”

**Why:** Generation, relevance selection, publication, storage, configuration defaults, and document authorization already belong to the existing EDUwAI backend.

**How to apply:** Do not introduce generation, OCR, ranking, storage access, admin settings, regeneration, or an original-page viewer. Generated mode uses only the server-selected physical IDs and authenticated generated-image bytes. Omit missing/unpublished images without original-page or diagram fallback. Personal resources keep their separate citation pathway.

Sources is a generic configurable plain-text notice, not a numbered/clickable list. Its notice and the page-context notice are separate settings. The shared page section consumes only the first source's image array. Role labels belong beneath images as UI; shared zoom displays the same image without the role strip or page numbers.

**Why:** These distinctions are explicit acceptance boundaries in the supplied handoff; sample wording is not production data or a client default.

**How to apply:** Preserve API-provided notice text. Do not replace settings with the sample wording or add a local legacy/default algorithm. Consume inline non-streaming image data without an extra fetch; streamed image requests share the existing answer cancellation fence.
