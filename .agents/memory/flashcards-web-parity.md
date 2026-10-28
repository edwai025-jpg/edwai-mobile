---
name: Flashcards web parity
description: User-supplied flashcard contract: backend-owned answer-dependent counts, exact type palettes, local state, and no new generation backend.
---

Flashcards must follow the user's complete web API/UI handoff, not a locally chosen card count or a new generation service. The backend uses only the first 15,000 answer characters internally. Below 100 whitespace-separated words it asks for 2–3 cards; longer answers target max(4, min(10, ceil(words/110))). Targets are not exact counts: local backend validation permits 2–10 for short answers and 4–10 for longer ones.

**Why:** The user requested matching web colors, API behavior, and number of cards per completed response, and supplied a source-verified handoff explaining the active compact generator rather than its unused legacy helpers.

**How to apply:** Send the original completed question and answer unchanged. Display the returned ordered array/count without padding, slicing, predicting a count, or sending a size/model/language selector. Do not switch API origins merely because an illustrative production origin is in the handoff; reuse the existing environment-aware session and configured origin.

Face colors are type-driven, including repeated types and the complete Concept fallback. Mastery cannot recolor a face; collapse retains mounted state, while regeneration clears the deck/mastery immediately. Mastery has no persistence or synchronization endpoint.

**Why:** These are explicit web semantics in the user's handoff, not additional mobile product features.

**How to apply:** Keep all study actions on the frozen completed answer and generate only after the learner's action. A 65-second application deadline does not mean backend work stopped; retain deliberate retry and stale-response protection. Institute subdomains are existing session context, not authorization or values to infer from IDs.
