---
name: Package installation verification
description: Verify physical dependency installation separately from lockfile updates.
---

Do not assume a successful package installation response means the running workspace has the new packages. Verify a resolved package version or symlink before running compatibility checks.

**Why:** The package installation interface updated the lockfile successfully while this workspace's dependency symlinks still pointed at the previous vulnerable versions. Synchronizing the workspace installation was necessary before testing.

**How to apply:** After dependency remediation, check both the lockfile audit and actual installed versions. Preserve the minimum-release-age protection and use the latest mature compatible release rather than exempting a newer release from that protection.

When Expo recommends an exact native dependency version, preserve that exact pin rather than the caret range its installer may write.

**Why:** Expo's alignment command can install the correct version but write a caret range, allowing a subsequent dependency refresh to select a native minor release that differs from Expo Go's bundled module.

**How to apply:** Compare the resulting manifest ranges with Expo's recommendations after alignment, not just the installed versions. Keep the exact-version recommendation exact.
