---
name: Native profile photo transport
description: Why phone photo uploads must not depend on FormData file-object compatibility.
---

Keep native profile-photo uploads as a pre-encoded, bounded multipart byte body. Keep browser uploads as ordinary browser FormData. Do not change the global fetch implementation or automatically retry a write with a different transport.

**Why:** A phone reported `Unsupported FormDataPart implementation` even after the SDK's isolated file-object encoder test passed. That test proves only the installed encoder contract, not every device's FormData/runtime combination.

**How to apply:** Test the actual API request headers/body together, through Expo's request-body normalizer and an HTTP multipart parser. A multipart Content-Type must carry the same boundary as the encoded byte body. Recheck byte preservation and file-size validation when changing this transport. Reload the phone's app after updates; a browser pass does not prove the phone has loaded the current bundle.
