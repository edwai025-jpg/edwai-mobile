---
name: Academic class selection handoff
description: Profile default, institute fallback, and the external backend's cross-grade document restriction.
---

Default academic class to the authenticated profile's class only when it appears in the server's available-class list; compare IDs as strings. Board students have no fallback to another grade. Institute students (`org_role === 'student'` plus `org_id`) prefer the assigned class using the org-provided class name, otherwise the first returned organization class. Never mix board and organization lists or overwrite a deliberate class selection with a later default.

**Why:** The user requested the web team's academic class-selection handoff, with no additional changes. This extends initial class defaulting, not profile assignment or personal-source behavior.

**How to apply:** Keep every returned class selectable and preserve the source-selection visibility rules. Loading the initial profile class can legitimately lead to the existing one-subject/one-source auto-selection; it is not restoration of an old saved source.

Cross-grade book access for board students remains limited by the external `/api/documents` route's additional profile-class restriction, even when available classes and subjects include other grades. An empty document response can therefore be correct.

**Why:** The web handoff explicitly identifies this backend limitation and excludes any backend access-rule change.

**How to apply:** Use only the existing authenticated classes/subjects/documents endpoints. Do not pass alternative board/org/user identities, invent available grades, bypass document access, or promise full cross-grade books without an explicitly authorized backend change.
