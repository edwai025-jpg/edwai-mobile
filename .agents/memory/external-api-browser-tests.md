---
name: External API browser-test isolation
description: Safe request interception and one-time auth seeding for browser tests against the external EdwAI backend.
---

Use a single fail-closed fixture router for external API browser tests. Every external API request must either receive a known fixture or a local rejection; never continue an unmatched API request to the network.

**Why:** Playwright's route.continue bypasses earlier interception handlers rather than falling through to them. An incomplete override allowed test requests to reach the external API even though another catch-all fixture existed.

**How to apply:** Guard both preview-proxy and direct upstream API URLs, including unauthenticated OTP endpoints. Do not infer isolation from fictional bearer credentials; unauthenticated operations can still have effects.

Seed fictional authentication once for logout tests, not with an init script that re-seeds every navigation.

**Why:** Navigation-time re-seeding can silently restore authentication after successful logout and make a correct session transition appear broken.

**How to apply:** Keep seeding separate from app navigation and verify storage stays empty after the protected-route revisit.

Cross-origin browser fixtures must model response-header exposure, not just return application headers.

**Why:** A valid explanation transcript header was present in the fixture response but unreadable to browser JavaScript without CORS exposure. This falsely appeared to be a transcript-rendering failure while audio playback and quota updates worked.

**How to apply:** When mocking binary audio with transcript metadata, include the appropriate allow-origin and expose-headers values. Distinguish missing fixture exposure from decoding or rendering bugs before changing application behavior.
