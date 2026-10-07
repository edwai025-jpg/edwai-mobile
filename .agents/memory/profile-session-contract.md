---
name: External Profile session contract
description: Why bearer-only mobile sessions are not marked current, and how external timestamps must be interpreted.
---

Do not infer the current native session from a device name, login method or recency. The external backend identifies the current session from its refresh cookie; bearer-only mobile calls can legitimately return every session as not current. Do not add a guessed refresh-token body to the sessions request.

**Why:** The user supplied a source-verified supplement confirming the cookie limitation. Native mobile uses a separate credential store, not the web refresh cookie.

**How to apply:** Trust the server's current-session flag, explain the limitation near revocation controls, and obtain a backend contract change before claiming native current-device identification works.

Interpret timezone-less session timestamps as UTC while preserving explicit timezone offsets.

**Why:** The user confirmed that the external backend serializes UTC timestamps without a timezone suffix.

**How to apply:** Normalize before calculating relative times; do not treat them as device-local times or append a second timezone suffix.
