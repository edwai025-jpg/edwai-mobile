---
name: Mobile visual direction
description: Web-reference parity for the entry page and study banner without copying web navigation.
---

The user wants the mobile main page in the format of their EDUwAI website login reference: lotus/book logo, white background, Phone/Email options, OTP action, Google sign-in, and teacher-trust / Made in India messaging.

**Why:** The user explicitly supplied this format as the starting point for the mobile version.

**How to apply:** Keep future entry-page changes consistent with that reference, adapted to phone-sized screens. Do not treat this visual request as permission to redesign authenticated study screens or change OAuth behavior.

When matching the authenticated study banner to the web version, reuse its visual theme and relevant API behavior, not its web navigation or profile placement. Preserve the mobile banner's compact size and layout; Profile remains a separate mobile tab.

**Why:** The user repeatedly distinguished web styling from mobile architecture and explicitly asked not to change the mobile layout.

**How to apply:** Scope web-banner parity to colors, backgrounds and dynamic identity/photo/billing data. Do not add the web Profile control or copy desktop dimensions into the mobile banner.

The onboarding What's New cards should scroll rather than require clicking the Next button.

**Why:** The user explicitly requested this change to the newly added announcement cards.

**How to apply:** Preserve this interaction when revising the onboarding announcement panel; do not reintroduce required arrow-button navigation.