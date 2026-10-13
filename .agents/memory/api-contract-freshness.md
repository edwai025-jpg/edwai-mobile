---
name: External API contract freshness
description: Verify legacy handoff endpoints against the live EDUwAI OpenAPI contract before blaming connectivity.
---

The original mobile handoff examples can contain outdated EDUwAI endpoint paths. Check the external server's live OpenAPI contract when a request fails instead of assuming the handoff still matches production.

**Why:** A textbook-status request returned 404 despite working login and catalog requests; the live API documented a different route. A broad catch displayed this as an unreachable server.

**How to apply:** Distinguish HTTP errors, authentication failures, and transport failures. Correct confirmed route mismatches rather than hiding warnings or inventing successful status data. Unauthenticated route checks establish route existence, not success for the user's authenticated account.
