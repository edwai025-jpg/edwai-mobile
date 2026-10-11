---
name: Question section visibility
description: User-supplied web rules for when academic and personal question sections appear.
---

Start both source selections empty. Hide the entire question section, including draft/voice controls, until a source is selected. Do not restore a previous textbook selection to make it visible.

**Why:** The user reported that mobile showed the question box without class/subject/textbook selection and supplied the exact web visibility rule to implement.

**How to apply:** Academic visibility depends on the selected source object, not separate class/subject checks. Changing class or subject clears the source; selecting the empty source option clears it too. Auto-select a subject or textbook only when exactly one is available. Switching to Own Books clears the academic source; switching to Textbooks clears the personal source.

Personal cards can be manually selected when processing status is completed. Uploading alone does not select a resource; a processing-to-ready polling result can auto-select it. A personal PDF needs no academic subject. A YouTube selection additionally requires an explicit notes/qa choice, reset when the personal resource changes. Switching PDF/YouTube tabs clears an incompatible selected resource; deleting the selected resource clears it.

**Why:** Readiness, selection, and YouTube interaction mode have different roles in the supplied web contract.

**How to apply:** Preserve existing Notes/Ask Questions behavior rather than showing an unbound composer or starting generation upon resource selection. Discard stale catalogue responses after selection/mode/account changes so they cannot restore a cleared selection.
