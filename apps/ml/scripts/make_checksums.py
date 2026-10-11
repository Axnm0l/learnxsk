"""Checksums for every generated artifact.

Writes ``reports/checksums.json`` with a SHA-256 and byte size per file under the
training root, plus a combined digest so the whole artifact set can be compared
in one value. ``--verify`` re-hashes the files and fails if anything changed,
which is how a rerun proves it is reproducible.

The virtualenv and the download cache are skipped: they are reproducible from
requirements, not artifacts of this run.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _common  # noqa: E402

SKIP_DIRS = {".venv", "cache", "__pycache__", ".git"}

# The manifest cannot include its own hash: writing the file would change it, so
# every `--verify` run would report the manifest as modified.
MANIFEST_RELATIVE = "reports/checksums.json"


def iter_artifacts(root: Path) -> list[Path]:
    files: list[Path] = []
    for path in sorted(root.rglob("*")):
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        if not path.is_file() or path.suffix == ".tmp":
            continue
        relative = str(path.relative_to(root)).replace("\\", "/")
        if relative == MANIFEST_RELATIVE:
            continue
        files.append(path)
    return files


def main(argv: list[str] | None = None) -> int:
    _common.configure_stdout()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--verify", action="store_true",
                        help="Re-hash and fail if any file changed since the manifest.")
    _common.add_common_args(parser)
    args = parser.parse_args(argv)

    root = _common.resolve_output_root(args.out_root)
    manifest_path = _common.artifact_path("reports/checksums.json", args.out_root)

    if args.verify:
        if not manifest_path.is_file():
            raise SystemExit(f"no checksums to verify: {manifest_path}")
        previous = json.loads(manifest_path.read_text(encoding="utf-8"))
        mismatches: list[str] = []
        missing: list[str] = []
        for relative, entry in previous["files"].items():
            path = root / relative
            if not path.is_file():
                missing.append(relative)
                continue
            digest = _common.sha256_file(path)
            if digest != entry["sha256"]:
                mismatches.append(relative)
        changed_or_missing = mismatches + missing
        _common.info(f"verified {len(previous['files'])} file(s); "
                     f"{len(mismatches)} changed, {len(missing)} missing")
        for item in mismatches:
            _common.info(f"  CHANGED {item}")
        for item in missing:
            _common.info(f"  MISSING {item}")
        return 0 if not changed_or_missing else 1

    files = iter_artifacts(root)
    entries: dict[str, dict[str, object]] = {}
    running = _common.sha256_text("")
    for path in files:
        relative = str(path.relative_to(root)).replace("\\", "/")
        digest = _common.sha256_file(path)
        entries[relative] = {"sha256": digest, "size_bytes": path.stat().st_size}
        running = _common.sha256_text(running + digest)

    payload = {
        "root": str(root),
        "file_count": len(entries),
        "total_bytes": sum(int(e["size_bytes"]) for e in entries.values()),
        "combined_digest": running,
        "files": entries,
        "skipped_directories": sorted(SKIP_DIRS),
        "excluded_from_manifest": [MANIFEST_RELATIVE],
    }
    _common.write_json_atomic(manifest_path, payload)
    _common.info(f"hashed {len(entries)} file(s), {payload['total_bytes']} bytes")
    _common.info(f"combined digest: {running}")
    _common.info(f"wrote {manifest_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
