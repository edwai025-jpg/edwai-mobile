---
name: Profile completion contract
description: User-approved completion scope and external backend limitations that native onboarding must preserve.
---

The user wants the setup guide first, then Profile, then What's New & Resources. Include the full handoff's onboarding flows, not only styling. This overrides the handoff's mobile-web form-first ordering.

**Why:** The user explicitly selected the order and approved phone verification, missing board/class requests, and institute-student terms using existing web APIs.

**How to apply:** Keep this scoped to new-user completion, not the separate mobile Profile tab or other study screens.

The guide-first order refers to onboarding content, not global navigation. Home, Back to Login, and EDUwAI branding belong above that content rather than inside the profile form.

**Why:** The user explicitly requested easier access to navigation at the top of Complete Profile.

**How to apply:** Preserve the navigation header independently of the guide → form → announcements order when revising onboarding.

The external backend can save a name-only Own Resources profile while returning `profile_complete=false`. Ordinary completion depends on name plus board; pre-registered students depend on the terms timestamp. Normal-user checkbox agreement is local and is not guaranteed to persist a terms timestamp.

**Why:** These are explicit limitations in the supplied web handoff, not errors to conceal with a fabricated default board or a locally forced permanent completion flag.

**How to apply:** Honor returned user/completion truth. Allow successful name-only Own Resources for the current session, but expect required setup again on a later sign-in. Do not describe ordinary checkbox acceptance as persisted compliance.

Curriculum requests and profile saves commit independently. The request endpoint has no documented idempotency or provisioning guarantee. Omitting curriculum IDs in profile PATCH does not clear existing saved IDs.

**Why:** The handoff documents separate commits and nullable-PATCH limitations; the mobile project does not own that backend.

**How to apply:** Prevalidate before creating requests, remember confirmed request results across save retries, and treat timeouts or unconfirmed responses as ambiguous rather than blindly retrying POST. Do not promise immediate curriculum availability or cleared IDs.
