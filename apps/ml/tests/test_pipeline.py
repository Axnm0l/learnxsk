"""Unit tests for the LearnXSK Gemma 4 data pipeline.

Run with the standard library only (no pytest needed):

    python apps/ml/tests/test_pipeline.py
    python -m unittest discover -s apps/ml/tests

Every test that writes goes to a temporary directory. The datasets tree is only
ever read.
"""

from __future__ import annotations

import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent.parent / "scripts"
sys.path.insert(0, str(SCRIPTS))

import _common  # noqa: E402
import _sources  # noqa: E402
import dedupe as dedupe_mod  # noqa: E402
import evaluate as evaluate_mod  # noqa: E402
import quality_filter as qf  # noqa: E402
import split_dataset as split_mod  # noqa: E402


class OutputGuardTests(unittest.TestCase):
    """Generated artifacts must never land in the datasets tree or the repo."""

    def test_datasets_directory_is_refused(self) -> None:
        target = _common.datasets_root() / "processed"
        with self.assertRaises(_common.UnsafeOutputPathError):
            _common.assert_safe_output_root(target)

    def test_repo_directory_is_refused(self) -> None:
        target = _common.repo_root() / "apps" / "ml" / "out"
        with self.assertRaises(_common.UnsafeOutputPathError):
            _common.assert_safe_output_root(target)

    def test_traversal_out_of_training_root_is_refused(self) -> None:
        with self.assertRaises(_common.UnsafeOutputPathError):
            _common.artifact_path("../../datasets/evil.jsonl", None)

    def test_training_root_accepted_and_created(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            # A temp dir is neither the datasets tree nor the repo, so the guard
            # must accept it and prove it can write.
            resolved = _common.assert_safe_output_root(Path(tmp) / "nested" / "root")
            self.assertTrue(resolved.is_dir())


class AdapterTests(unittest.TestCase):
    def test_linux_command_repair_of_invalid_escape(self) -> None:
        parsed, flags = _sources.parse_jsonl_line(
            r'{"id":"cmd-455","command":"tree -if --noreport /etc | grep \'\.conf$\'"}')
        self.assertIsNotNone(parsed, "the bare backslash escape should be repaired")
        self.assertIn("repaired_invalid_escape", flags)
        self.assertIn("\\.conf", parsed["command"])

    def test_valid_json_needs_no_repair(self) -> None:
        parsed, flags = _sources.parse_jsonl_line('{"a": "b"}')
        self.assertEqual(flags, [])
        self.assertEqual(parsed, {"a": "b"})

    def test_unparseable_line_reports_instead_of_raising(self) -> None:
        parsed, flags = _sources.parse_jsonl_line('{"a": ')
        self.assertIsNone(parsed)
        self.assertIn("unparseable_json", flags)

    def test_mcq_lettering_is_positional(self) -> None:
        options = _sources._options_from_list(["one", "two", "three", "four"])
        self.assertEqual(sorted(options), ["A", "B", "C", "D"])
        prompt = _sources.render_mcq_prompt("Pick one", options)
        self.assertIn("A) one", prompt)
        self.assertIn("Respond with the letter", prompt)

    def test_multi_select_label_is_sorted_and_flagged(self) -> None:
        letters, multi = _sources.normalize_answer_label("DB", 4)
        self.assertEqual(letters, "BD")
        self.assertTrue(multi)

    def test_label_beyond_option_count_is_filtered(self) -> None:
        letters, multi = _sources.normalize_answer_label("E", 4)
        self.assertEqual(letters, "")
        self.assertFalse(multi)

    def test_kali_adapter_synthesizes_prompt_and_flags_it(self) -> None:
        dataset = {"id": "KALI_LINUX_TOOLKIT_DATASET",
                   "task_type": "tool_usage_synthesis"}
        spec = {"source_path": "KALI_LINUX_TOOLKIT_DATASET/KALI_LINUX_TOOLS_DATASET.jsonl",
                "adapter": "kali_tool_card", "usage": "sft_train"}
        records = list(_sources.iter_dataset_records(dataset, spec,
                                                     _common.datasets_root()))
        self.assertGreater(len(records), 100)
        self.assertIn("synthesized_prompt", records[0].flags)
        self.assertIn("nmap", records[0].prompt)


class DedupeTests(unittest.TestCase):
    def _rows(self):
        return iter([
            {"id": "a", "prompt": "What is a firewall?", "answer": "x" * 120},
            {"id": "b", "prompt": "what is a firewall?", "answer": "x" * 120},
            {"id": "c", "prompt": "What is a firewall?", "answer": "y" * 120},
            {"id": "d", "prompt": "No answer here", "answer": ""},
        ])

    def test_exact_duplicates_collapse_ignoring_case(self) -> None:
        stream, counters, _examples = dedupe_mod.dedupe(
            self._rows(), exact=True, near=False, bands=4, max_distance=3,
            shingle_width=5)
        kept = [row["id"] for row in stream]
        self.assertEqual(kept.count("a"), 1)
        self.assertNotIn("b", kept, "case-only difference must be an exact duplicate")
        self.assertIn("c", kept, "same prompt with a different answer is not a duplicate")
        self.assertEqual(counters["dropped_exact_duplicate"], 1)

    def test_rows_without_answers_pass_through(self) -> None:
        stream, counters, _examples = dedupe_mod.dedupe(
            self._rows(), exact=True, near=True, bands=4, max_distance=3,
            shingle_width=5)
        kept = list(stream)
        self.assertIn("d", [row["id"] for row in kept])
        self.assertEqual(counters["rows_passed_through_no_answer"], 1)

    def test_near_duplicate_detected_by_simhash(self) -> None:
        body = " ".join(f"word{i}" for i in range(200))
        rows = iter([
            {"id": "a", "prompt": "p", "answer": body},
            {"id": "b", "prompt": "p", "answer": body + " extra"},
        ])
        stream, counters, examples = dedupe_mod.dedupe(
            rows, exact=True, near=True, bands=4, max_distance=3, shingle_width=5)
        kept = [row["id"] for row in stream]
        self.assertEqual(kept, ["a"])
        self.assertEqual(counters["dropped_near_duplicate"], 1)
        self.assertEqual(examples[0]["reason"], "near")


class QualityFilterTests(unittest.TestCase):
    settings = {
        "min_prompt_chars": 10, "min_answer_chars": 20, "min_words_answer": 3,
        "max_prompt_chars": 12000, "max_answer_chars": 20000,
        "max_repeated_token_ratio": 0.55, "max_symbol_ratio": 0.60,
        "min_ascii_or_cjk_ratio": 0.70, "drop_empty_assistant": True,
        "drop_refusal_answers": True, "drop_prompt_echoing_answer": True,
        "mask_secrets": True,
    }
    refusals = (__import__("re").compile(r"as an ai language model", __import__("re").I),)

    def check(self, record):
        return qf.should_drop(record, self.settings, self.refusals)

    def test_chinese_answer_is_not_rejected_by_word_count(self) -> None:
        # The whole point: Chinese has no spaces, so a whitespace word count
        # would score this sentence as one word and reject it.
        record = {
            "prompt": "为什么现代操作系统的IP ID通常是随机产生的?",
            "answer": "为了提高安全性,防止某些类型的网络攻击,并降低被推测的几率。",
            "task_type": "short_answer", "usage": "sft_train",
        }
        reason, _masked = self.check(record)
        self.assertIsNone(reason, f"Chinese answer must survive, got {reason}")

    def test_one_letter_mcq_answer_is_not_degenerate(self) -> None:
        record = {
            "prompt": "Question with options\n\nOptions:\nA) x\nB) y",
            "answer": "B", "task_type": "multiple_choice", "usage": "eval_only",
        }
        reason, _masked = self.check(record)
        self.assertIsNone(reason, f"MCQ letter answer must survive, got {reason}")

    def test_genuinely_degenerate_answer_is_dropped(self) -> None:
        record = {"prompt": "Explain the CIA triad in detail please",
                  "answer": " ".join(["the"] * 60), "task_type": "short_answer",
                  "usage": "sft_train"}
        reason, _masked = self.check(record)
        self.assertEqual(reason, "degenerate_repetition")

    def test_refusal_answer_is_dropped(self) -> None:
        record = {"prompt": "Explain the CIA triad in detail please",
                  "answer": "As an AI language model I cannot provide that information.",
                  "task_type": "short_answer", "usage": "sft_train"}
        reason, _masked = self.check(record)
        self.assertEqual(reason, "refusal_answer")

    def test_short_answer_is_dropped(self) -> None:
        record = {"prompt": "Explain the CIA triad in detail please",
                  "answer": "Yes.", "task_type": "short_answer", "usage": "sft_train"}
        reason, _masked = self.check(record)
        self.assertIn(reason, {"answer_too_short", "answer_too_few_words"})

    def test_credential_assignment_is_masked_not_dropped(self) -> None:
        record = {"prompt": "How do I rotate a leaked key?",
                  "answer": "First set password: hunter2secret in the vault, then "
                            "rotate the key and audit the access logs afterwards.",
                  "task_type": "short_answer", "usage": "sft_train"}
        reason, masked = self.check(record)
        self.assertIsNone(reason)
        self.assertIn("credential_assignment", masked)
        redacted, hits = qf.mask_secrets(record["answer"])
        self.assertIn("<<REDACTED:credential_assignment>>", redacted)
        self.assertNotIn("hunter2secret", redacted)

    def test_prose_mention_of_a_password_is_not_masked(self) -> None:
        # The rule deliberately matches assignments (`password: value`), not any
        # sentence containing the word, so ordinary teaching text survives.
        prose = ("If a password is reused across systems, rotate it in the vault "
                 "and audit the logs afterwards.")
        redacted, hits = qf.mask_secrets(prose)
        self.assertEqual(hits, [])
        self.assertEqual(redacted, prose)


class FormatTests(unittest.TestCase):
    def test_system_prompt_is_added_when_missing(self) -> None:
        import format_sft  # noqa: PLC0415
        record = {"prompt": "What is nmap?", "answer": "A network scanner.",
                  "usage": "sft_train"}
        settings = {"include_system_prompt": True, "system_prompt": "You are a tutor."}
        messages, flags = format_sft.build_messages(record, settings, 1000)
        self.assertEqual(messages[0]["role"], "system")
        self.assertEqual([m["role"] for m in messages], ["system", "user", "assistant"])
        self.assertNotIn("source_system_prompt", flags)

    def test_source_system_prompt_is_preserved(self) -> None:
        import format_sft  # noqa: PLC0415
        record = {"messages": [
            {"role": "system", "content": "Source system prompt."},
            {"role": "user", "content": "Question?"},
            {"role": "assistant", "content": "Original answer."},
        ], "usage": "sft_train"}
        settings = {"include_system_prompt": True, "system_prompt": "Ours."}
        messages, flags = format_sft.build_messages(record, settings, 1000)
        self.assertIn("source_system_prompt", flags)
        self.assertNotIn("Ours.", [m["content"] for m in messages])

    def test_truncation_happens_at_a_paragraph_boundary(self) -> None:
        import format_sft  # noqa: PLP0415
        text = "First paragraph." * 10 + "\n\n" + "Second paragraph." * 50
        truncated, changed = format_sft.truncate_at_paragraph(text, 200)
        self.assertTrue(changed)
        self.assertLessEqual(len(truncated), 200)
        self.assertFalse(truncated.endswith("Second"), "must not cut mid-word")

    def test_short_answer_is_untouched(self) -> None:
        import format_sft  # noqa: PLC0415
        text = "Short answer."
        self.assertEqual(format_sft.truncate_at_paragraph(text, 200), (text, False))


class SplitTests(unittest.TestCase):
    def test_assignment_is_deterministic_and_ratio_shaped(self) -> None:
        ratios = [("train", 0.90), ("validation", 0.05), ("test", 0.05)]
        counts = {"train": 0, "validation": 0, "test": 0}
        for index in range(4000):
            fraction = _common.seeded_index("dataset", f"row-{index}") / float(1 << 64)
            name = split_mod.bucket(fraction, ratios)
            counts[name] += 1
        self.assertEqual(sum(counts.values()), 4000)
        for name, share in (("train", 0.90), ("validation", 0.05), ("test", 0.05)):
            self.assertLess(abs(counts[name] / 4000 - share), 0.03, counts)

    def test_same_key_always_gets_the_same_split(self) -> None:
        ratios = [("train", 0.9), ("validation", 0.05), ("test", 0.05)]
        first = split_mod.bucket(
            _common.seeded_index("ds", "key") / float(1 << 64), ratios)
        second = split_mod.bucket(
            _common.seeded_index("ds", "key") / float(1 << 64), ratios)
        self.assertEqual(first, second)


class NormalizationTests(unittest.TestCase):
    def test_normalized_key_ignores_case_and_whitespace(self) -> None:
        self.assertEqual(_common.normalized_key("Hello   World"),
                         _common.normalized_key("hello world"))

    def test_hamming_distance(self) -> None:
        self.assertEqual(_common.hamming64(0b1011, 0b1001), 1)
        self.assertEqual(_common.hamming64(5, 5), 0)

    def test_simhash_of_identical_text_matches(self) -> None:
        text = " ".join(f"token{i}" for i in range(300))
        self.assertEqual(_common.simhash64(text), _common.simhash64(text))


class EvaluationScoringTests(unittest.TestCase):
    def test_letter_extraction(self) -> None:
        self.assertEqual(evaluate_mod.extract_letters("The answer is B."), "B")
        self.assertEqual(evaluate_mod.extract_letters("B and D are correct."), "BD")
        self.assertEqual(evaluate_mod.extract_letters("no letter here!"), "")

    def test_token_f1_bounds_and_cjk(self) -> None:
        self.assertEqual(evaluate_mod.token_f1("alpha beta", "alpha beta"), 1.0)
        self.assertEqual(evaluate_mod.token_f1("alpha", "beta"), 0.0)
        self.assertGreater(evaluate_mod.token_f1("为了提高安全性", "为了提高安全性"), 0.0)

    def test_exact_match_is_normalized(self) -> None:
        self.assertEqual(evaluate_mod.exact_match("CWE-416", "cwe-416"), 1.0)


class ManifestTests(unittest.TestCase):
    def test_manifest_licenses_and_usage_are_coherent(self) -> None:
        manifest = _sources.load_manifest(
            Path(__file__).resolve().parent.parent / "configs" / "dataset_manifest.yaml")
        ids = [dataset["id"] for dataset in manifest["datasets"]]
        self.assertEqual(len(ids), len(set(ids)), "dataset ids must be unique")
        for dataset in manifest["datasets"]:
            self.assertIn(dataset["usage"],
                          {"sft_train", "eval_only", "reference_only", "exclude"})
            if not dataset["license_commercial_ok"]:
                self.assertNotEqual(
                    dataset["usage"], "sft_train",
                    f"{dataset['id']} is non-commercial but marked for training")
        excluded = set(manifest["excluded_from_training"])
        for dataset in manifest["datasets"]:
            if dataset["id"] in excluded:
                self.assertNotEqual(dataset["usage"], "sft_train")

    def test_config_paths_stay_inside_the_training_root(self) -> None:
        config = _common.load_yaml(
            Path(__file__).resolve().parent.parent / "configs" / "data_pipeline.yaml")
        with tempfile.TemporaryDirectory() as tmp:
            for relative in config["paths"]["outputs"].values():
                resolved = _common.artifact_path(relative, tmp)
                self.assertTrue(str(resolved).startswith(str(Path(tmp).resolve())))


if __name__ == "__main__":
    unittest.main(verbosity=2)
