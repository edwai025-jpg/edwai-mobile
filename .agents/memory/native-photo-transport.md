---
name: Native profile photo transport
description: Native file-object compatibility, bounded photo encoding, and large PDF uploads without background retries.
---

Keep native profile-photo uploads as a pre-encoded, bounded multipart byte body. Keep browser uploads as ordinary browser FormData. Do not change the global fetch implementation or automatically retry a write with a different transport.

**Why:** A phone reported `Unsupported FormDataPart implementation` even after the SDK's isolated file-object encoder test passed. That test proves only the installed encoder contract, not every device's FormData/runtime combination.

**How to apply:** Test the actual API request headers/body together, through Expo's request-body normalizer and an HTTP multipart parser. A multipart Content-Type must carry the same boundary as the encoded byte body. Recheck byte preservation and file-size validation when changing this transport. Reload the phone's app after updates; a browser pass does not prove the phone has loaded the current bundle.

Do not generalize bounded photo encoding to potentially large PDFs. Native PDF uploads should avoid whole-file JavaScript buffers and must not silently retry interrupted writes through an iOS background session.

**Why:** Expo's native multipart API can read a cached document directly. Its background session mode explicitly retries network failures indefinitely, which is unsafe for a document-creation endpoint without a confirmed idempotency contract. Native multipart still uses native memory; it is not proof of constant-memory streaming.

**How to apply:** Use a foreground native upload for personal PDFs, keep the browser's real File/Blob, preserve the server's upload limits and access errors, and treat lost responses as uncertain rather than automatically resubmitting.
