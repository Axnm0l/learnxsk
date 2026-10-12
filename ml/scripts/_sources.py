"""Shared source-adapter layer for the LearnXSK Gemma 4 data pipeline.

Every read-only dataset is described once in ``apps/ml/configs/dataset_manifest.yaml``
and turned into the same normalized record shape here, so that
``audit_datasets.py``, ``prepare_dataset.py`` and ``evaluate.py`` cannot drift
apart in how they read a file.

Normalized record shape (one JSON object per line)::

    {
      "id":              "secbench-mcq-000123",
      "source_dataset":  "SecBench",
      "source_file":     "SecBench/data/MCQs_2730.jsonl",
      "adapter":         "mcq_options_answer",
      "row_index":       122,
      "usage":           "eval_only",
      "task_type":       "multiple_choice",
      "language":        "Chinese",
      "prompt":          "<rendered prompt, options inlined for MCQs>",
      "answer":          "B",
      "messages":        null,
      "options":         {"A": "...", "B": "..."},
      "answer_label":    "B",
      "metadata":        {...},
      "flags":           ["repaired_invalid_escape"],
    }

Nothing in this module writes to disk, and nothing mutates the datasets tree.
"""

from __future__ import annotations

import csv
import json
import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterator

import _common

# --------------------------------------------------------------------------
# Record shape
# --------------------------------------------------------------------------

OPTION_LETTERS = "ABCDEFGH"


@dataclass
class SourceRecord:
    source_dataset: str
    source_file: str
    adapter: str
    row_index: int
    usage: str
    task_type: str
    prompt: str | None = None
    answer: str | None = None
    options: dict[str, str] | list[str] | None = None
    answer_label: str | None = None
    messages: list[dict[str, str]] | None = None
    language: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)
    flags: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        record_id = _common.stable_id(
            self.source_dataset.split("-")[0].lower() or "row",
            self.source_file,
            str(self.row_index),
            self.prompt or "",
            self.answer or "",
        )
        return {
            "id": record_id,
            "source_dataset": self.source_dataset,
            "source_file": self.source_file,
            "adapter": self.adapter,
            "row_index": self.row_index,
            "usage": self.usage,
            "task_type": self.task_type,
            "language": self.language,
            "prompt": self.prompt,
            "answer": self.answer,
            "messages": self.messages,
            "options": self.options,
            "answer_label": self.answer_label,
            "metadata": self.metadata,
            "flags": list(self.flags),
        }


# --------------------------------------------------------------------------
# Manifest loading
# --------------------------------------------------------------------------

def load_manifest(path: str | os.PathLike[str]) -> dict[str, Any]:
    return _common.load_yaml(path)


def iter_source_specs(manifest: dict[str, Any]
                      ) -> Iterator[tuple[dict[str, Any], dict[str, Any]]]:
    """Yield ``(dataset_entry, source_spec)`` for every file the manifest lists.

    A dataset entry either carries a single ``adapter`` or an ``adapters`` list;
    both are flattened into the same shape here so callers never branch.
    """
    for dataset in manifest.get("datasets", []):
        if "adapters" in dataset:
            for spec in dataset["adapters"]:
                merged = dict(spec)
                merged.setdefault("usage", dataset.get("usage", "sft_train"))
                merged.setdefault("quality_gates", dataset.get("quality_gates", {}))
                yield dataset, merged
        else:
            yield dataset, {k: dataset.get(k) for k in (
                "source_path", "adapter", "usage", "field_map", "quality_gates",
                "canonical", "reason", "task_type",
            ) if dataset.get(k) is not None}


def resolve_source_path(datasets_root: Path, spec: dict[str, Any]) -> Path:
    rel = spec["source_path"]
    return (Path(datasets_root) / rel).resolve()


# --------------------------------------------------------------------------
# JSONL repair
# --------------------------------------------------------------------------

_INVALID_ESCAPE_RE = re.compile(r'\\(?!["\\/bfnrtu])')


def parse_jsonl_line(raw: str) -> tuple[dict[str, Any] | None, list[str]]:
    """Parse one JSONL line, repairing bare backslash escapes if needed.

    Exactly one upstream row (Linux_Terminal_Commands cmd-455) contains a bare
    ``\\.`` sequence that is not valid JSON. Rather than silently dropping the
    row or guessing at its content, backslashes that cannot start a valid JSON
    escape are re-escaped and the repair is recorded as a flag.
    """
    stripped = raw.strip()
    if not stripped:
        return None, ["blank_line"]
    try:
        parsed = json.loads(stripped)
        return (parsed if isinstance(parsed, dict) else {"__value__": parsed}), []
    except json.JSONDecodeError:
        pass
    repaired = _INVALID_ESCAPE_RE.sub(r"\\\\", stripped)
    try:
        parsed = json.loads(repaired)
    except json.JSONDecodeError:
        return None, ["unparseable_json"]
    if isinstance(parsed, dict):
        return parsed, ["repaired_invalid_escape"]
    return {"__value__": parsed}, ["repaired_invalid_escape"]


def iter_jsonl_dicts(path: Path) -> Iterator[tuple[int, dict[str, Any] | None, list[str]]]:
    with path.open("r", encoding="utf-8", errors="replace", newline="") as handle:
        for index, raw in enumerate(handle, start=1):
            if not raw.strip():
                continue
            parsed, flags = parse_jsonl_line(raw)
            yield index, parsed, flags


def _clean(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False)
    return _common.normalize_text(str(value))


def _options_from_mapping(mapping: dict[str, Any]) -> dict[str, str]:
    return {str(k).strip().upper(): _clean(v) for k, v in mapping.items()}


def _options_from_list(values: list[Any]) -> dict[str, str]:
    return {OPTION_LETTERS[i]: _clean(v) for i, v in enumerate(values)
            if i < len(OPTION_LETTERS)}


def render_mcq_prompt(question: str, options: dict[str, str]) -> str:
    """Inline lettered options into the prompt text.

    Letters are generated by position, matching how the upstream ``label`` /
    ``solution`` fields are written (SecBench's ``answers`` list carries no
    letters of its own, so this is the only consistent mapping).
    """
    lines = [question.strip(), "", "Options:"]
    for letter in OPTION_LETTERS:
        if letter in options:
            lines.append(f"{letter}) {options[letter]}")
    lines.append("")
    if len(options) > 1:
        lines.append("Respond with the letter of the correct option.")
    return "\n".join(lines)


def normalize_answer_label(label: str, option_count: int) -> tuple[str, bool]:
    """Return ``(upper_letters, is_multi_select)`` for an MCQ label field."""
    letters = re.sub(r"[^A-Za-z]", "", label or "").upper()
    letters = "".join(sorted(set(letters)))
    letters = "".join(c for c in letters if c in OPTION_LETTERS[:option_count])
    ordered = "".join(sorted(set(letters), key=lambda c: OPTION_LETTERS.index(c)))
    return ordered, len(ordered) > 1


# --------------------------------------------------------------------------
# Adapters
# --------------------------------------------------------------------------

def _adapter_trendyol_chat(dataset, spec, path, datasets_root, ctx
                           ) -> Iterator[SourceRecord]:
    for index, row, flags in iter_jsonl_dicts(path):
        if row is None:
            yield _malformed(dataset, spec, path, datasets_root, index, flags)
            continue
        system = _clean(row.get("system"))
        user = _clean(row.get("user"))
        assistant = _clean(row.get("assistant"))
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": user})
        messages.append({"role": "assistant", "content": assistant})
        yield SourceRecord(
            source_dataset=dataset["id"], source_file=_rel(path, datasets_root),
            adapter=spec["adapter"], row_index=index, usage=spec["usage"],
            task_type=dataset.get("task_type", "instruction_following"),
            prompt=user, answer=assistant, messages=messages,
            language="en",
            metadata={"system_prompt_chars": len(system)},
            flags=list(flags),
        )


def _qa_adapter(task_type: str, prompt_field: str, answer_field: str,
                language_field: str | None, extra_fields: tuple[str, ...]):
    def adapter(dataset, spec, path, datasets_root, ctx) -> Iterator[SourceRecord]:
        for index, row, flags in iter_jsonl_dicts(path):
            if row is None:
                yield _malformed(dataset, spec, path, datasets_root, index, flags)
                continue
            metadata = {f: row.get(f) for f in extra_fields if row.get(f) is not None}
            yield SourceRecord(
                source_dataset=dataset["id"], source_file=_rel(path, datasets_root),
                adapter=spec["adapter"], row_index=index, usage=spec["usage"],
                task_type=task_type,
                prompt=_clean(row.get(prompt_field)),
                answer=_clean(row.get(answer_field)),
                language=_clean(row.get(language_field)) if language_field else None,
                metadata=metadata, flags=list(flags),
            )
    return adapter


_adapter_qa_reference = _qa_adapter(
    "open_question_answering", "question", "reference_answer", "language",
    ("id", "category", "subcategory", "difficulty", "source"),
)
_adapter_qa_short_answer = _qa_adapter(
    "short_answer", "question", "answer", "language",
    ("ability", "domain"),
)


def _adapter_mcq_list(dataset, spec, path, datasets_root, ctx) -> Iterator[SourceRecord]:
    """SecBench MCQs: ``answers`` is an un-lettered list, ``label`` is a string."""
    for index, row, flags in iter_jsonl_dicts(path):
        if row is None:
            yield _malformed(dataset, spec, path, datasets_root, index, flags)
            continue
        raw_options = row.get("answers")
        options = (_options_from_list(raw_options) if isinstance(raw_options, list)
                   else _options_from_mapping(raw_options or {}))
        label, multi = normalize_answer_label(_clean(row.get("label")), len(options))
        local_flags = list(flags)
        if multi:
            local_flags.append("multi_select_answer")
        if not options:
            local_flags.append("no_options")
        if not label:
            local_flags.append("no_valid_answer_label")
        yield SourceRecord(
            source_dataset=dataset["id"], source_file=_rel(path, datasets_root),
            adapter=spec["adapter"], row_index=index, usage=spec["usage"],
            task_type="multiple_choice",
            prompt=render_mcq_prompt(_clean(row.get("question")), options),
            answer=label, options=options, answer_label=label,
            language=_clean(row.get("language")) or None,
            metadata={k: row.get(k) for k in ("ability", "domain") if row.get(k)},
            flags=local_flags,
        )


def _adapter_mcq_mapping(dataset, spec, path, datasets_root, ctx) -> Iterator[SourceRecord]:
    """CyberMetric MCQs: a JSON document with ``questions: [...]``."""
    with path.open("r", encoding="utf-8", errors="replace") as handle:
        document = json.load(handle)
    questions = document.get("questions") if isinstance(document, dict) else document
    if not isinstance(questions, list):
        raise SystemExit(f"unexpected CyberMetric document shape in {path}")
    for index, row in enumerate(questions, start=1):
        if not isinstance(row, dict):
            continue
        raw_options = row.get("answers")
        options = (_options_from_mapping(raw_options) if isinstance(raw_options, dict)
                   else _options_from_list(raw_options or []))
        label, multi = normalize_answer_label(_clean(row.get("solution")), len(options))
        local_flags = ["multi_select_answer"] if multi else []
        if not label:
            local_flags.append("no_valid_answer_label")
        yield SourceRecord(
            source_dataset=dataset["id"], source_file=_rel(path, datasets_root),
            adapter=spec["adapter"], row_index=index, usage=spec["usage"],
            task_type="multiple_choice",
            prompt=render_mcq_prompt(_clean(row.get("question")), options),
            answer=label, options=options, answer_label=label,
            language="en", metadata={}, flags=local_flags,
        )


def _adapter_tsv_mcq(dataset, spec, path, datasets_root, ctx) -> Iterator[SourceRecord]:
    yield from _tsv_rows(dataset, spec, path, datasets_root, mcq=True)


def _adapter_tsv_prompt_answer(dataset, spec, path, datasets_root, ctx
                               ) -> Iterator[SourceRecord]:
    yield from _tsv_rows(dataset, spec, path, datasets_root, mcq=False)


def _adapter_tsv_prompt_only(dataset, spec, path, datasets_root, ctx
                             ) -> Iterator[SourceRecord]:
    for index, row in _iter_tsv(path):
        prompt = _clean(row.get("Prompt"))
        metadata = {k: v for k, v in row.items()
                    if k.lower() not in {"prompt"} and v}
        yield SourceRecord(
            source_dataset=dataset["id"], source_file=_rel(path, datasets_root),
            adapter=spec["adapter"], row_index=index, usage=spec["usage"],
            task_type="prompt_only",
            prompt=prompt, answer=None, language="en",
            metadata=metadata, flags=["no_ground_truth_in_snapshot"],
        )


def _iter_tsv(path: Path) -> Iterator[tuple[int, dict[str, str]]]:
    with path.open("r", encoding="utf-8", errors="replace", newline="") as handle:
        reader = csv.reader(handle, delimiter="\t")
        try:
            header = next(reader)
        except StopIteration:
            return
        for index, row in enumerate(reader, start=1):
            yield index, {header[i]: (row[i] if i < len(row) else "")
                          for i in range(len(header))}


def _tsv_rows(dataset, spec, path, datasets_root, mcq: bool) -> Iterator[SourceRecord]:
    for index, row in _iter_tsv(path):
        prompt = _clean(row.get("Prompt"))
        if not prompt:
            # Some CTI-Bench rows carry the question without the rendered prompt.
            question = _clean(row.get("Question"))
            if mcq and question:
                options = _options_from_mapping({
                    "A": row.get("Option A", ""), "B": row.get("Option B", ""),
                    "C": row.get("Option C", ""), "D": row.get("Option D", ""),
                })
                prompt = render_mcq_prompt(question, options["A"] and options or {})
            else:
                prompt = question
        answer = _clean(row.get("GT"))
        metadata = {k: v for k, v in row.items()
                    if k.lower() not in {"prompt", "gt"} and v}
        yield SourceRecord(
            source_dataset=dataset["id"], source_file=_rel(path, datasets_root),
            adapter=spec["adapter"], row_index=index, usage=spec["usage"],
            task_type="multiple_choice" if mcq else "prompt_answer",
            prompt=prompt, answer=answer or None, language="en",
            metadata=metadata,
            flags=[] if answer else ["no_ground_truth_in_snapshot"],
        )


def _adapter_kali_tool_card(dataset, spec, path, datasets_root, ctx
                            ) -> Iterator[SourceRecord]:
    for index, row, flags in iter_jsonl_dicts(path):
        if row is None:
            yield _malformed(dataset, spec, path, datasets_root, index, flags)
            continue
        command = _clean(row.get("command"))
        tool = _clean(row.get("tool"))
        description = _clean(row.get("description"))
        use_case = _clean(row.get("use_case"))
        category = _clean(row.get("category"))
        flags_list = row.get("flags") or []
        if isinstance(flags_list, list):
            rendered_flags = ", ".join(f"`{_clean(f)}`" for f in flags_list if _clean(f))
        else:
            rendered_flags = _clean(flags_list)
        reference = _clean(row.get("reference_link"))
        os_name = _clean(row.get("os")) or "Linux"

        prompt = (f"On {os_name} (Kali tooling), what does `{command}` do and "
                  f"when should I use it?")
        parts = [f"`{command}` — {description}" if description else f"`{command}`"]
        if use_case:
            parts.append(f"\nUse case: {use_case}")
        if tool:
            parts.append(f"Tool: `{tool}`")
        if category:
            parts.append(f"Category: {category}")
        if rendered_flags:
            parts.append(f"Relevant flags: {rendered_flags}")
        if reference:
            parts.append(f"Reference: {reference}")
        yield SourceRecord(
            source_dataset=dataset["id"], source_file=_rel(path, datasets_root),
            adapter=spec["adapter"], row_index=index, usage=spec["usage"],
            task_type="tool_usage_synthesis",
            prompt=prompt, answer="\n".join(parts), language="en",
            metadata={"tool": tool, "category": category, "os": os_name,
                      "reference_link": reference, "synthesized_prompt": True},
            flags=list(flags) + ["synthesized_prompt"],
        )


def _adapter_linux_command_card(dataset, spec, path, datasets_root, ctx
                                ) -> Iterator[SourceRecord]:
    for index, row, flags in iter_jsonl_dicts(path):
        if row is None:
            yield _malformed(dataset, spec, path, datasets_root, index, flags)
            continue
        command = _clean(row.get("command"))
        description = _clean(row.get("description"))
        example = _clean(row.get("example_output"))
        man = _clean(row.get("man_reference"))
        category = _clean(row.get("category"))
        prompt = f"What does the Linux terminal command `{command}` do?"
        parts = [f"`{command}` — {description}" if description else f"`{command}`"]
        if example:
            parts.append(f"\nTypical output: {example}")
        if category:
            parts.append(f"Category: {category}")
        if man:
            parts.append(f"Manual page: {man}")
        yield SourceRecord(
            source_dataset=dataset["id"], source_file=_rel(path, datasets_root),
            adapter=spec["adapter"], row_index=index, usage=spec["usage"],
            task_type="tool_usage_synthesis",
            prompt=prompt, answer="\n".join(parts), language="en",
            metadata={"command_id": row.get("id"), "category": category,
                      "man_reference": man, "synthesized_prompt": True},
            flags=list(flags) + ["synthesized_prompt"],
        )


def _adapter_nice_components(dataset, spec, path, datasets_root, ctx
                             ) -> Iterator[SourceRecord]:
    document = _common.read_json(path)
    elements = document.get("elements") or []
    relationships = document.get("relationships") or []
    if not isinstance(elements, list):
        raise SystemExit(f"unexpected NICE components shape in {path}")

    yield SourceRecord(
        source_dataset=dataset["id"], source_file=_rel(path, datasets_root),
        adapter="nice_components_summary", row_index=0,
        usage="reference_only", task_type="taxonomy_reference",
        prompt=None, answer=None, language="en",
        metadata={
            "element_count": len(elements),
            "relationship_count": len(relationships),
            "documents": [d.get("identifier") or d.get("title")
                          for d in document.get("documents", [])],
            "empty_text_elements": sum(
                1 for e in elements if not _clean(e.get("text"))
            ),
        },
        flags=["reference_only_not_sft"],
    )

    for index, element in enumerate(elements, start=1):
        text = _clean(element.get("text"))
        yield SourceRecord(
            source_dataset=dataset["id"], source_file=_rel(path, datasets_root),
            adapter=spec["adapter"], row_index=index,
            usage="reference_only", task_type="taxonomy_reference",
            prompt=_clean(element.get("title")) or None,
            answer=text or None, language="en",
            metadata={
                "element_type": element.get("element_type"),
                "element_identifier": element.get("element_identifier"),
                "title": element.get("title"),
                "doc_identifier": element.get("doc_identifier"),
                "text_is_empty": not text,
            },
            flags=["reference_only_not_sft"] + ([] if text else ["empty_text"]),
        )


def _adapter_xlsx_reference(dataset, spec, path, datasets_root, ctx
                            ) -> Iterator[SourceRecord]:
    """One reference record per worksheet: header + dimensions, not every cell."""
    try:
        import openpyxl  # type: ignore
    except ImportError:
        yield SourceRecord(
            source_dataset=dataset["id"], source_file=_rel(path, datasets_root),
            adapter=spec["adapter"], row_index=0, usage="reference_only",
            task_type="reference_table", language="en",
            metadata={"unavailable": "openpyxl not installed", "file": path.name},
            flags=["reference_only_not_sft", "reader_unavailable"],
        )
        return
    workbook = openpyxl.load_workbook(path, read_only=True, data_only=True)
    try:
        for index, sheet in enumerate(workbook.worksheets, start=1):
            header: list[str] = []
            row_count = 0
            for row in sheet.iter_rows(values_only=True):
                if not header and any(c is not None for c in row):
                    header = [str(c) if c is not None else "" for c in row]
                    continue
                if any(c is not None for c in row):
                    row_count += 1
            yield SourceRecord(
                source_dataset=dataset["id"], source_file=_rel(path, datasets_root),
                adapter=spec["adapter"], row_index=index,
                usage="reference_only", task_type="reference_table",
                prompt=f"{path.name} :: {sheet.title}",
                answer=None, language="en",
                metadata={"sheet": sheet.title, "columns": header,
                          "data_rows": row_count, "file": path.name},
                flags=["reference_only_not_sft"],
            )
    finally:
        workbook.close()


def _adapter_pdf_reference(dataset, spec, path, datasets_root, ctx
                           ) -> Iterator[SourceRecord]:
    metadata: dict[str, Any] = {"file": path.name, "size_bytes": path.stat().st_size}
    try:
        import pypdf  # type: ignore
        reader = pypdf.PdfReader(str(path))
        metadata["pages"] = len(reader.pages)
    except ImportError:
        metadata["pages"] = None
        metadata["reader"] = "pypdf not installed"
    yield SourceRecord(
        source_dataset=dataset["id"], source_file=_rel(path, datasets_root),
        adapter=spec["adapter"], row_index=1, usage="reference_only",
        task_type="reference_document", prompt=path.name, answer=None,
        language="en", metadata=metadata,
        flags=["reference_only_not_sft"],
    )


def _malformed(dataset, spec, path, datasets_root, index, flags) -> SourceRecord:
    return SourceRecord(
        source_dataset=dataset["id"], source_file=_rel(path, datasets_root),
        adapter=spec["adapter"], row_index=index, usage="exclude",
        task_type="malformed", prompt=None, answer=None,
        metadata={}, flags=list(flags) + ["excluded_malformed_row"],
    )


ADAPTERS = {
    "trendyol_chat": _adapter_trendyol_chat,
    "qa_question_reference_answer": _adapter_qa_reference,
    "qa_short_answer": _adapter_qa_short_answer,
    "mcq_options_answer": _adapter_mcq_list,
    "mcq_options_solution": _adapter_mcq_mapping,
    "tsv_mcq": _adapter_tsv_mcq,
    "tsv_prompt_answer": _adapter_tsv_prompt_answer,
    "tsv_prompt_no_ground_truth": _adapter_tsv_prompt_only,
    "kali_tool_card": _adapter_kali_tool_card,
    "linux_command_card": _adapter_linux_command_card,
    "nice_components_json": _adapter_nice_components,
    "xlsx_reference": _adapter_xlsx_reference,
    "pdf_reference": _adapter_pdf_reference,
}


def _rel(path: Path, datasets_root: Path) -> str:
    try:
        return str(path.relative_to(Path(datasets_root).resolve())).replace("\\", "/")
    except ValueError:
        return str(path).replace("\\", "/")


def iter_dataset_records(dataset: dict[str, Any], spec: dict[str, Any],
                         datasets_root: Path,
                         ctx: dict[str, Any] | None = None
                         ) -> Iterator[SourceRecord]:
    """Stream normalized records for one manifest source spec."""
    adapter_name = spec.get("adapter")
    if adapter_name not in ADAPTERS:
        raise SystemExit(f"unknown adapter in manifest: {adapter_name!r}")
    path = resolve_source_path(datasets_root, spec)
    if not path.is_file():
        raise SystemExit(f"manifest points at a missing file: {path}")
    yield from ADAPTERS[adapter_name](dataset, spec, path, datasets_root, ctx or {})


def iter_all_records(manifest: dict[str, Any], datasets_root: Path,
                     usages: tuple[str, ...] | None = None,
                     dataset_ids: tuple[str, ...] | None = None,
                     ) -> Iterator[SourceRecord]:
    """Stream every record in the manifest, optionally filtered by usage/id."""
    for dataset, spec in iter_source_specs(manifest):
        if dataset_ids and dataset["id"] not in dataset_ids:
            continue
        for record in iter_dataset_records(dataset, spec, datasets_root):
            if usages and record.usage not in usages:
                continue
            yield record


__all__ = [
    "OPTION_LETTERS",
    "SourceRecord",
    "load_manifest",
    "iter_source_specs",
    "iter_dataset_records",
    "iter_all_records",
    "resolve_source_path",
    "parse_jsonl_line",
    "iter_jsonl_dicts",
    "render_mcq_prompt",
    "normalize_answer_label",
]
