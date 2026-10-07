---
name: Completed-answer study resources
description: User-supplied scope and semantics for study resource controls on mobile.
---

The user wants the web's five completed-answer actions inside the mobile Answer card on both Textbooks and Own Books, using existing EDUwAI APIs. Preserve mobile screen layouts and do not rebuild the backend or modify the web app.

**Why:** The user provided a source-based handoff and screenshot specifically for controls that appear and function after an answer is retrieved.

**How to apply:** Tie all resources to a frozen completed-answer context, not the current editable question or book selector. Voice explanation quota is separate from question usage and displayed as remaining/limit. Replay never regenerates a tutor explanation. Reports are sent only after explicit submission; mastery is local. Do not automatically retry ambiguous explanation/report failures, since the backend may have consumed quota or saved the report.

The handoff documents limited audio excerpts and formula stripping, and warns that Odia Explain audio may fall back to English. Browser fixtures are not evidence of real-device interruption handling or production authorization.

**Why:** These are backend and verification limitations, not missing native layout features.

**How to apply:** Retain honest user-facing notices and distinguish browser checks from actual iOS/Android playback validation.
