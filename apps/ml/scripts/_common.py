"""Shared helpers for the LearnXSK Gemma 4 fine-tuning pipeline.

This module is imported by every other script under ``apps/ml/scripts``. It owns
exactly one responsibility: deciding where generated artifacts are allowed to be
written, and refusing to write anywhere unsafe.

Safety contract
---------------
All generated artifacts MUST live under the configured training root, which
defaults to::

    C:\\Users\\anmol\\OneDrive\\Desktop\\hackathon\\training

Writing is refused when the resolved target would land:

* inside the read-only datasets directory, or
* inside the LearnXSK Git repository, or
* in a location that is not writable.

The override is a single documented mechanism: the ``LEARNXSK_TRAINING_ROOT``
environment variable, or the ``--out-root`` command line flag (which sets the
same value). The default is always the path above.

Dependencies: Python standard library only. This module must import cleanly on a
bare interpreter so that ``inventory_datasets.py`` and ``preflight.py`` can run
before any ML packages are installed.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import sys
import tempfile
from pathlib import Path
from typing import Any, Iterable, Iterator

# --------------------------------------------------------------------------
# Canonical default paths (Windows). Overridable, never silently changed.
# --------------------------------------------------------------------------

DEFAULT_TRAINING_ROOT = Path(
    r"C:\Users\anmol\OneDrive\Desktop\hackathon\training"
)
DEFAULT_DATASETS_ROOT = Path(
    r"C:\Users\anmol\OneDrive\Desktop\hackathon\datasets"
)
DEFAULT_REPO_ROOT = Path(r"C:\Users\anmol\OneDrive\Desktop\LearnXSK")

ENV_TRAINING_ROOT = "LEARNXSK_TRAINING_ROOT"
ENV_DATASETS_ROOT = "LEARNXSK_DATASETS_ROOT"
ENV_REPO_ROOT = "LEARNXSK_REPO_ROOT"


class UnsafeOutputPathError(RuntimeError):
    """Raised when an artifact would be written outside the training root."""


def _from_env(name: str, default: Path) -> Path:
    raw = os.environ.get(name)
    if raw and raw.strip():
        return Path(raw.strip())
    return default


def datasets_root() -> Path:
    """Read-only source datasets directory."""
    return _from_env(ENV_DATASETS_ROOT, DEFAULT_DATASETS_ROOT)


def repo_root() -> Path:
    """LearnXSK Git repository root (source code lives here, artifacts do not)."""
    return _from_env(ENV_REPO_ROOT, DEFAULT_REPO_ROOT)


def training_root(override: str | os.PathLike[str] | None = None) -> Path:
    """Resolve the training output root.

    Precedence: explicit ``override`` argument > ``LEARNXSK_TRAINING_ROOT``
    environment variable > :data:`DEFAULT_TRAINING_ROOT`.
    """
    if override is not None:
        return Path(override)
    return _from_env(ENV_TRAINING_ROOT, DEFAULT_TRAINING_ROOT)


def _norm(path: Path) -> Path:
    """Best-effort absolute, symlink-resolved path for containment checks."""
    try:
        return Path(os.path.normcase(str(path.resolve())))
    except OSError:
        return Path(os.path.normcase(str(path.absolute())))


def _is_within(child: Path, parent: Path) -> bool:
    child_n = _norm(child)
    parent_n = _norm(parent)
    if child_n == parent_n:
        return True
    try:
        child_n.relative_to(parent_n)
        return True
    except ValueError:
        return False


def assert_safe_output_root(root: Path) -> Path:
    """Validate that ``root`` is a legal place to write generated artifacts.

    Returns the resolved path. Raises :class:`UnsafeOutputPathError` otherwise.
    """
    root = Path(root)

    if _is_within(root, datasets_root()):
        raise UnsafeOutputPathError(
            f"Refusing to write artifacts inside the read-only datasets "
            f"directory.\n  requested: {root}\n  datasets : {datasets_root()}"
        )

    if _is_within(root, repo_root()):
        raise UnsafeOutputPathError(
            f"Refusing to write generated artifacts inside the LearnXSK git "
            f"repository. Large/generated artifacts belong in the training "
            f"root.\n  requested: {root}\n  repo     : {repo_root()}"
        )

    try:
        root.mkdir(parents=True, exist_ok=True)
    except OSError as exc:
        raise UnsafeOutputPathError(
            f"Training root is not creatable/writable: {root} ({exc})"
        ) from exc

    try:
        with tempfile.NamedTemporaryFile(
            mode="w", dir=root, prefix=".write_probe_", suffix=".tmp",
            delete=True,
        ) as probe:
            probe.write("ok")
            probe.flush()
    except OSError as exc:
        raise UnsafeOutputPathError(
            f"Training root is not writable: {root} ({exc})"
        ) from exc

    return root


def resolve_output_root(override: str | os.PathLike[str] | None = None) -> Path:
    """Return a validated training root, creating it if necessary."""
    return assert_safe_output_root(training_root(override))


def artifact_path(relative: str | os.PathLike[str],
                  override: str | os.PathLike[str] | None = None) -> Path:
    """Resolve ``relative`` under the validated training root and guard it.

    Parent directories are created. The containment check runs against the
    fully resolved absolute target, so ``..`` traversal is rejected too.
    """
    root = resolve_output_root(override)
    target = (root / relative)
    target_abs = _norm(target)

    for forbidden, label in (
        (datasets_root(), "read-only datasets directory"),
        (repo_root(), "LearnXSK git repository"),
    ):
        if _is_within(target_abs, forbidden):
            raise UnsafeOutputPathError(
                f"Artifact path escapes into the {label}: {target}"
            )

    if not _is_within(target_abs, root):
        raise UnsafeOutputPathError(
            f"Artifact path escapes the training root: {target} (root {root})"
        )

    target.parent.mkdir(parents=True, exist_ok=True)
    return target


def add_common_args(parser) -> None:
    """Attach the standard ``--out-root`` option to an ArgumentParser."""
    parser.add_argument(
        "--out-root",
        default=None,
        help=(
            "Override the training output root. Default: "
            f"{DEFAULT_TRAINING_ROOT} (or ${ENV_TRAINING_ROOT}). "
            "Marked as the single documented override mechanism."
        ),
    )


def configure_stdout() -> None:
    """Force UTF-8 stdout so non-ASCII dataset content never crashes on Windows.

    The default Windows console code page (cp1252) raises ``UnicodeEncodeError``
    when printing Chinese (SecBench) or smart punctuation (Trendyol) samples.
    Every script calls this before it prints anything.
    """
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if reconfigure is not None:
            try:
                reconfigure(encoding="utf-8", errors="replace")
            except (ValueError, OSError):  # pragma: no cover - non-reconfigurable stream
                pass


def info(message: str) -> None:
    print(f"[learnxsk-ml] {message}", file=sys.stdout, flush=True)


# --------------------------------------------------------------------------
# Config loading
# --------------------------------------------------------------------------

def load_yaml(path: str | os.PathLike[str]) -> dict[str, Any]:
    """Load a YAML document, raising a clear error if PyYAML is unavailable."""
    path = Path(path)
    if not path.is_file():
        raise FileNotFoundError(f"config not found: {path}")
    try:
        import yaml  # type: ignore
    except ImportError as exc:  # pragma: no cover - dependency guard
        raise RuntimeError(
            "PyYAML is required to read pipeline configs; install it with "
            "`pip install pyyaml`."
        ) from exc
    with path.open("r", encoding="utf-8") as handle:
        data = yaml.safe_load(handle)
    if not isinstance(data, dict):
        raise ValueError(f"config must be a YAML mapping: {path}")
    return data


# --------------------------------------------------------------------------
# Streaming JSONL IO (never loads a whole dataset into memory)
# --------------------------------------------------------------------------

def iter_jsonl(path: str | os.PathLike[str],
               tolerate_errors: bool = False
               ) -> Iterator[tuple[int, dict[str, Any] | None, str]]:
    """Yield ``(line_number, parsed_or_None, raw_line)`` for a JSONL file."""
    path = Path(path)
    with path.open("r", encoding="utf-8", errors="replace", newline="") as handle:
        for line_number, raw in enumerate(handle, start=1):
            stripped = raw.strip()
            if not stripped:
                yield line_number, None, raw
                continue
            try:
                parsed = json.loads(stripped)
            except json.JSONDecodeError:
                if not tolerate_errors:
                    yield line_number, None, raw
                    continue
                yield line_number, None, raw
                continue
            if isinstance(parsed, dict):
                yield line_number, parsed, raw
            else:
                yield line_number, {"__value__": parsed}, raw


def write_jsonl_atomic(path: Path, records: Iterable[dict[str, Any]]) -> int:
    """Write records to ``path`` via a temp file + replace. Returns the count."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    count = 0
    with tmp.open("w", encoding="utf-8", newline="\n") as handle:
        for record in records:
            handle.write(json.dumps(record, ensure_ascii=False))
            handle.write("\n")
            count += 1
    os.replace(tmp, path)
    return count


def read_json(path: str | os.PathLike[str]) -> Any:
    with Path(path).open("r", encoding="utf-8") as handle:
        return json.load(handle)


def write_json_atomic(path: Path, payload: Any) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    with tmp.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(payload, handle, indent=2, ensure_ascii=False, sort_keys=False)
        handle.write("\n")
    os.replace(tmp, path)


# --------------------------------------------------------------------------
# Text normalization, identity and near-duplicate detection
# --------------------------------------------------------------------------

_WS_RE = re.compile(r"\s+")
_CONTROL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def normalize_text(value: str) -> str:
    """Canonical whitespace/control-character form used for identity checks.

    Unicode is NFKC-normalized so that full-width and compatibility variants of
    the same CJK text collapse to one key.
    """
    import unicodedata
    text = unicodedata.normalize("NFKC", value)
    text = _CONTROL_RE.sub(" ", text)
    text = text.replace("\u00a0", " ")
    text = _WS_RE.sub(" ", text)
    return text.strip()


def normalized_key(*parts: str) -> str:
    """Case-folded, punctuation-stable join of the given text parts."""
    joined = "\u241f".join(normalize_text(p).casefold() for p in parts)
    return sha256_text(joined)


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def sha256_file(path: str | os.PathLike[str], chunk: int = 1024 * 1024) -> str:
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        while True:
            block = handle.read(chunk)
            if not block:
                break
            digest.update(block)
    return digest.hexdigest()


_TOKEN_RE = re.compile(r"[\w']+", re.UNICODE)
_SIMHASH_BITS = 64


def _token_shingles(text: str, width: int = 5) -> Iterator[str]:
    tokens = _TOKEN_RE.findall(normalize_text(text).casefold())
    if not tokens:
        return
    if len(tokens) < width:
        yield " ".join(tokens)
        return
    for index in range(len(tokens) - width + 1):
        yield " ".join(tokens[index:index + width])


def simhash64(text: str, width: int = 5) -> int:
    """64-bit SimHash over token shingles, used for near-duplicate grouping.

    Implemented with the standard library only so the pipeline has no native
    dependency for this stage.
    """
    vector = [0] * _SIMHASH_BITS
    produced = False
    for shingle in _token_shingles(text, width):
        produced = True
        shingle_hash = int.from_bytes(
            hashlib.blake2b(shingle.encode("utf-8"), digest_size=8).digest(),
            "big",
        )
        for bit in range(_SIMHASH_BITS):
            vector[bit] += 1 if (shingle_hash >> bit) & 1 else -1
    if not produced:
        return 0
    result = 0
    for bit in range(_SIMHASH_BITS):
        if vector[bit] > 0:
            result |= 1 << bit
    return result


def hamming64(left: int, right: int) -> int:
    return int((left ^ right).bit_count())


def stable_id(prefix: str, *parts: str, length: int = 16) -> str:
    """Deterministic short identifier derived from the given parts."""
    digest = hashlib.sha256("\u241f".join(parts).encode("utf-8")).hexdigest()
    return f"{prefix}-{digest[:length]}"


def seeded_index(*parts: str) -> int:
    """Deterministic 64-bit integer for seeded splitting (stable across runs)."""
    digest = hashlib.sha256("\u241f".join(parts).encode("utf-8")).digest()
    return int.from_bytes(digest[:8], "big")


__all__ = [
    "DEFAULT_TRAINING_ROOT",
    "DEFAULT_DATASETS_ROOT",
    "DEFAULT_REPO_ROOT",
    "ENV_TRAINING_ROOT",
    "UnsafeOutputPathError",
    "datasets_root",
    "repo_root",
    "training_root",
    "assert_safe_output_root",
    "resolve_output_root",
    "artifact_path",
    "add_common_args",
    "info",
    "configure_stdout",
    "load_yaml",
    "iter_jsonl",
    "write_jsonl_atomic",
    "read_json",
    "write_json_atomic",
    "normalize_text",
    "normalized_key",
    "sha256_text",
    "sha256_file",
    "simhash64",
    "hamming64",
    "stable_id",
    "seeded_index",
]
