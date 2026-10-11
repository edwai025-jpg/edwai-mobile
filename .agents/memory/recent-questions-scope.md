---
name: Recent Questions integration scope
description: Web-handoff boundaries, boolean bookmark semantics, and external backend streaming persistence timing.
---

Recent Questions is mobile UI integration with the existing EDUwAI backend, not a separate history/tag service. The screenshot's tag control means a boolean bookmark, not named custom tags. The backend owns the per-user/book 100-history and 50-bookmark limits and eviction; mobile must not synthesize history records or enforce retention in local storage.

**Why:** The user asked to replicate the web panel and use the supplied web-app APIs, whose shared backend is the system of record.

**How to apply:** Preserve separate shared/personal ID spaces and account/book-scoped UI state. Selecting a row only replaces the draft and cancels voice work; it must not restore an answer, change answer mode, or submit another question.

The external streaming backend can persist history after emitting its terminal done event. Cancelling the response at that event can interrupt persistence.

**Why:** The source-derived web handoff explicitly describes done-before-history timing; successful answer delivery is not a history-commit acknowledgment.

**How to apply:** Allow the response to close normally, then refresh history with a bounded extra GET. Never manufacture a local row or resubmit an answer to recover a missing history record.
