---
name: Question input handoff scope
description: Fidelity boundaries for adapting the web's four question-input modes to mobile.
---

Prefer the detailed EDUwAI Input Modes Mobile Handoff PDF's explicit controls and library boundaries when they conflict with the HTML's general recommendations. This is an input-feature parity port, not a redesign of the app or a new speech backend.

**Why:** The PDF specifies existing Unicode tab icons, exact custom default/shift layouts, and unchanged append-at-end/one-UTF-16-unit keyboard deletion semantics. It explicitly excludes new icon, keyboard, provider, and formatting libraries unless native capture needs an integration.

**How to apply:** Preserve literal key outputs and independent language selections; do not silently replace the custom keyboard with an OS IME or change its deletion behavior as an unrelated Unicode improvement. Use the existing mobile controls, renderer, and compatible native audio bridge.

Voice allowance is independent of answer usage; answering requires a selected book and an explicit answer action. Access to draft and voice controls follows the whole-question-section source-selection gate. A successful transcription can consume voice allowance even when no answer is requested. Input mode is not answer mode.

**Why:** These are product and billing boundaries stated in the user's handoffs, not new client entitlements. The subsequent question-visibility handoff explicitly hides the entire question section until a source is selected.

**How to apply:** Keep voice-question allowance separate from answer counts and explanation/TTS allowance. Treat server balances and provider settings as authoritative; never assume cancellation refunded a transcription or that source-exported settings prove live production configuration.
