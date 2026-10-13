---
name: External API contract freshness
description: Verify legacy handoff endpoints against the live EDUwAI OpenAPI contract before blaming connectivity.
---

The original mobile handoff examples can contain outdated EDUwAI endpoint paths. Check the external server's live OpenAPI contract when a request fails instead of assuming the handoff still matches production.

**Why:** A textbook-status request returned 404 despite working login and catalog requests; the live API documented a different route. A broad catch displayed this as an unreachable server.

**How to apply:** Distinguish HTTP errors, authentication failures, and transport failures. Correct confirmed route mismatches rather than hiding warnings or inventing successful status data. Unauthenticated route checks establish route existence, not success for the user's authenticated account.

Restricted-board processing must be confirmed by a fresh authenticated status read, not an assumed start-response envelope or an optimistic access change.

**Why:** The live processing routes document no response schemas; starting processing creates a per-user access record. A route/authentication probe cannot establish authenticated success, and real processing must not be initiated merely for testing without authorization.

**How to apply:** Preserve server restriction truth, fail closed on unreadable status, and use simulated responses for transition regressions. Obtain authorized, read-only response evidence before accepting new response shapes.

API error messages should also direct the student to contact the EDUwAI team through in-app chat or the “Contact Us” section on the home page. Do not specify a phone number in the error message.

**Why:** The user requested contact guidance alongside identifying API errors and clarified that contact details are already in the home page’s Contact Us section.

**How to apply:** Keep the specific error and retry instructions visible; add support guidance rather than replacing the failure detail. Refer students to chat or Contact Us rather than repeating contact numbers.
