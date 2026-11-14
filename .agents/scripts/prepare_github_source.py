"""Export current application source without Replit history or reference uploads."""
from pathlib import Path
import hashlib
import json
import shutil
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "generated-artifacts" / "github-export"
SOURCE = OUTPUT / "eduwai-mobile"
ARCHIVE = OUTPUT / "eduwai-mobile-source.zip"
ROOT_FILES = {
    ".gitignore", ".npmrc", ".replit", ".replitignore", "package.json",
    "pnpm-lock.yaml", "pnpm-workspace.yaml", "tsconfig.base.json",
    "tsconfig.json", "README.md", "LICENSE", "LICENSE.md",
}
SOURCE_ROOTS = {"artifacts", "lib", "scripts"}
EXCLUDED_PARTS = {
    ".git", "node_modules", ".expo", ".expo-shared", ".cache", "__pycache__",
    "dist", "coverage", "generated-artifacts", "test-results",
    "playwright-report", "screenshots",
}
PRIVATE_SUFFIXES = {".pem", ".key", ".p12", ".pfx", ".jks", ".keystore", ".mobileprovision"}
EXPORT_IGNORES = """

# Reference material and workspace-only files are not application source.
/attached_assets/
/exports/
/.canvas/
/.agents/
/.local/
/.pythonlibs/
/.upm/
/footer_scroll.png
.env
.env.*
"""


def eligible(relative):
    parts = relative.parts
    return (
        (parts[0] in SOURCE_ROOTS or str(relative) in ROOT_FILES)
        and not any(part in EXCLUDED_PARTS for part in parts)
        and not relative.name.startswith(".env")
        and relative.suffix.lower() not in PRIVATE_SUFFIXES
        and relative.suffix not in {".log", ".tsbuildinfo", ".pyc"}
    )


def main():
    if SOURCE.exists() or ARCHIVE.exists():
        raise SystemExit("Export already exists; refusing to overwrite it.")
    candidates = subprocess.check_output(
        ["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard"],
        cwd=ROOT,
    ).decode().split("\0")
    copied = []
    for name in sorted(set(filter(None, candidates))):
        relative = Path(name)
        origin = ROOT / relative
        if not eligible(relative) or not origin.is_file():
            continue
        if origin.is_symlink():
            raise SystemExit(f"Review symbolic link before exporting: {relative}")
        target = SOURCE / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(origin, target)
        copied.append(name)

    # These extra exclusions apply only to the exported copy, not the live app.
    for filename in [".gitignore", ".replitignore"]:
        with (SOURCE / filename).open("a") as stream:
            stream.write(EXPORT_IGNORES)

    app_images = sorted(
        str(file.relative_to(SOURCE))
        for file in SOURCE.rglob("*")
        if file.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp", ".gif", ".pdf"}
    )
    expected_images = {
        "artifacts/mobile/assets/images/eduwai-logo.png",
        "artifacts/mobile/assets/images/icon.png",
        "artifacts/mobile/assets/images/splash-icon.png",
    }
    if set(app_images) != expected_images:
        raise SystemExit(f"Unexpected export assets require review: {app_images}")
    for required in [
        "package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml",
        "artifacts/mobile/app.json", "artifacts/mobile/package.json",
        "artifacts/api-server/src/routes/proxy.ts",
        "artifacts/mobile/.replit-artifact/artifact.toml",
    ]:
        if not (SOURCE / required).is_file():
            raise SystemExit(f"Missing required source file: {required}")

    # Verify source contents except the two intentionally expanded ignore files.
    for name in copied:
        if name not in {".gitignore", ".replitignore"}:
            if (ROOT / name).read_bytes() != (SOURCE / name).read_bytes():
                raise SystemExit(f"Copy verification failed: {name}")
    with zipfile.ZipFile(ARCHIVE, "w", zipfile.ZIP_DEFLATED) as archive:
        for file in sorted(SOURCE.rglob("*")):
            if file.is_file():
                archive.write(file, Path("eduwai-mobile") / file.relative_to(SOURCE))
    with zipfile.ZipFile(ARCHIVE) as archive:
        if archive.testzip() is not None:
            raise SystemExit("ZIP integrity verification failed.")
        if len(archive.namelist()) != len(copied):
            raise SystemExit("ZIP file count does not match source copy.")

    report = {
        "source_files": len(copied),
        "source_bytes": sum(file.stat().st_size for file in SOURCE.rglob("*") if file.is_file()),
        "archive_bytes": ARCHIVE.stat().st_size,
        "archive_sha256": hashlib.sha256(ARCHIVE.read_bytes()).hexdigest(),
        "included_images": app_images,
        "excluded": ["Git history", "uploaded references", "exports", "canvas files",
                     "agent notes", "dependencies", "caches", "build outputs", "environment files"],
        "original_reference_files_deleted": False,
    }
    (OUTPUT / "export-verification.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
