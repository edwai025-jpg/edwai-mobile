---
name: Answer formatting parity
description: Scope and interpretation of the user's web-derived mathematics, science, and Indian-language handoff.
---

Use one content renderer across subjects and languages, while preserving the existing mobile layout, study actions, and EDUwAI answer APIs. Decoded raw answers remain authoritative for study actions; visual formatting must not call a model or consume another question.

**Why:** The user supplied source-based web formatting documentation and asked to revisit mobile retrieval/rendering, not rebuild the backend or introduce subject-specific generation.

**How to apply:** Preserve backslashes, token whitespace, and Unicode. Do not apply speech stripping to displayed answers, translate prose, repair malformed mathematics, wrap bare LaTeX commands, or invent subscripts in unmarked chemistry. Source fixtures are acceptance inputs, not prompts for regenerating answers. Browser fixtures and a successful native bundle do not certify real-device typography, gestures, or live authenticated retrieval.

When chemistry alone fails while ordinary mathematics renders, check module-loading conditions before changing notation or backend behavior.

**Why:** CommonJS-transpiled test imports registered mhchem on KaTeX's CommonJS instance while rehype-katex imported the separate ES-module instance, producing a false chemistry failure. Expo's current import conditions use the ES-module pair.

**How to apply:** Keep renderer regression tests consistent with the app bundler's module conditions. Do not replace chemistry notation or add a second rendering service to compensate for a test-loader mismatch.
