---
name: Repository cleanup scope
description: Keep project Markdown, automated test code, and production assets when removing unused references.
---

Project Markdown documents and automated test scripts are intentional repository contents, not disposable test assets.

**Why:** The user explicitly requested keeping project `.md` files and chose “Keep automated tests” when clarifying the removal of screenshots and unused reference files.

**How to apply:** Future asset cleanups must preserve project documentation, regression-test source, and required app images. Distinguish uploaded sample/reference files from code that tests the application.
