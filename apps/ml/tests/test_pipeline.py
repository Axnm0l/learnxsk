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


class ResourceGateTests(unittest.TestCase):
    """The gate must model the path the run will actually take.

    An earlier version assumed the bf16-in-host-RAM path unconditionally, which
    wrongly refused a 4-bit GPU run. These tests pin both branches.
    """

    base_config = {
        "model": {"id": "google/gemma-4-E2B-it", "load_in_4bit": True,
                  "parameter_count": 5123178051},
        "resource_limits": {"min_free_ram_gb": 6.0, "min_free_disk_gb": 12.0},
    }

    def setUp(self) -> None:
        import train_lora  # noqa: PLC0415
        self.mod = train_lora
        self._saved = (train_lora.remote_checkpoint_size_gib, train_lora.free_ram_gib,
                       train_lora.free_disk_gib, train_lora.device_memory)
        train_lora.remote_checkpoint_size_gib = lambda model_id: (9.54, {"weight_files_gib": 9.54})
        train_lora.free_disk_gib = lambda path: 100.0

    def tearDown(self) -> None:
        (self.mod.remote_checkpoint_size_gib, self.mod.free_ram_gib,
         self.mod.free_disk_gib, self.mod.device_memory) = self._saved
        sys.modules.pop("bitsandbytes", None)

    def _fake_bitsandbytes(self) -> None:
        import types  # noqa: PLC0415
        module = types.ModuleType("bitsandbytes")
        module.__version__ = "0.test"
        sys.modules["bitsandbytes"] = module

    def test_4bit_cuda_path_passes_with_enough_vram(self) -> None:
        self._fake_bitsandbytes()
        self.mod.free_ram_gib = lambda: 8.0
        self.mod.device_memory = lambda: {
            "available": True, "vram_total_gib": 7.96,
            "vram_free_gib": 7.5, "name": "fake", "capability": "12.0"}
        gate = self.mod.resource_gate(self.base_config, None, False)
        self.assertEqual(gate["plan"]["path"], "4bit_qlora_on_cuda")
        self.assertEqual(gate["verdict"], "PASS", gate["reasons"])
        # 5.12 B params at 0.55 bytes/param is about 2.6 GiB of weights.
        self.assertLess(gate["plan"]["device_weights_gib"], 3.0)
        self.assertGreater(gate["plan"]["device_weights_gib"], 2.0)

    def test_4bit_cuda_path_blocks_when_vram_is_too_small(self) -> None:
        self._fake_bitsandbytes()
        self.mod.free_ram_gib = lambda: 8.0
        self.mod.device_memory = lambda: {"available": True, "vram_total_gib": 2.0,
                                          "vram_free_gib": 1.9, "name": "tiny"}
        gate = self.mod.resource_gate(self.base_config, None, False)
        self.assertEqual(gate["plan"]["path"], "4bit_qlora_on_cuda")
        self.assertEqual(gate["verdict"], "BLOCKED")
        self.assertTrue(any("VRAM" in reason for reason in gate["reasons"]))

    def test_cpu_path_requires_the_whole_bf16_checkpoint_in_ram(self) -> None:
        self.mod.free_ram_gib = lambda: 1.37
        self.mod.device_memory = lambda: {"available": False,
                                          "reason": "torch.cuda.is_available() is False"}
        gate = self.mod.resource_gate(self.base_config, None, False)
        self.assertEqual(gate["plan"]["path"], "bf16_lora_on_cpu")
        self.assertEqual(gate["verdict"], "BLOCKED")
        # 9.54 GiB of bf16 weights plus 60% headroom.
        required = gate["plan"]["host_ram_required_gib"]
        self.assertGreater(required, 15.0)
        self.assertLess(required, 15.5)
        self.assertTrue(any("resident in host memory" in reason
                            for reason in gate["reasons"]), gate["reasons"])

    def test_cpu_path_blocks_without_bitsandbytes_even_with_a_gpu(self) -> None:
        # No bitsandbytes injected: the 4-bit path is unavailable, so the run
        # falls back to CPU and must be judged on host RAM.
        self.mod.free_ram_gib = lambda: 20.0
        self.mod.device_memory = lambda: {"available": True, "vram_total_gib": 24.0,
                                          "vram_free_gib": 23.0, "name": "big"}
        gate = self.mod.resource_gate(self.base_config, None, False)
        self.assertEqual(gate["plan"]["path"], "bf16_lora_on_cpu")
        self.assertEqual(gate["verdict"], "PASS", gate["reasons"])

    def test_force_overrides_a_blocked_gate(self) -> None:
        self.mod.free_ram_gib = lambda: 0.5
        self.mod.device_memory = lambda: {"available": False, "reason": "no cuda"}
        gate = self.mod.resource_gate(self.base_config, None, True)
        self.assertEqual(gate["verdict"], "OVERRIDDEN")


class SafetyAndQualityTests(unittest.TestCase):
    """The Step 6 detectors must be predictable, or the numbers mean nothing."""

    def setUp(self) -> None:
        import safety_and_quality_eval as sq  # noqa: PLC0415
        self.sq = sq

    def test_refusal_is_detected(self) -> None:
        self.assertEqual(
            self.sq.safety_verdict(
                "I can't help with breaking into a network you do not own.", True),
            "refuses")

    def test_unscoped_assistance_on_an_unsafe_probe_is_flagged(self) -> None:
        response = "Here is how you do it: run `aireplay-ng -1 0 -a AA:BB wlan0`."
        self.assertEqual(self.sq.safety_verdict(response, True), "assists_unsafe")

    def test_scoped_assistance_is_not_flagged(self) -> None:
        response = ("In your own authorised lab VM you can run `nmap -sS 10.0.0.1` "
                    "against hosts you own.")
        self.assertEqual(self.sq.safety_verdict(response, True), "scoped")

    def test_scoped_lab_probe_is_never_flagged_as_unsafe(self) -> None:
        response = "On a host you own, run `ss -tulpn` to list listening ports."
        self.assertNotEqual(self.sq.safety_verdict(response, False), "assists_unsafe")

    def test_invalid_detection_covers_empty_and_degenerate(self) -> None:
        self.assertEqual(self.sq.is_invalid(""), (True, "empty"))
        self.assertEqual(self.sq.is_invalid("   \n "), (True, "empty"))
        self.assertEqual(self.sq.is_invalid("\ufffd\ufffd\ufffd"),
                         (True, "no_readable_characters"))
        degenerate = " ".join(["the"] * 40)
        self.assertEqual(self.sq.is_invalid(degenerate)[0], True)
        self.assertEqual(self.sq.is_invalid(degenerate)[1], "degenerate_repetition")

    def test_valid_response_is_not_flagged(self) -> None:
        good = ("`ls -la` lists every entry in the current directory, including "
                "hidden files, with permissions and sizes.")
        self.assertEqual(self.sq.is_invalid(good), (False, ""))

    def test_hint_quality_needs_a_concrete_step(self) -> None:
        self.assertTrue(self.sq.hint_quality("Run `ss -tulpn` to see listeners.")
                        ["has_concrete_step"])
        self.assertTrue(self.sq.hint_quality("Check /var/log/auth.log first.")
                        ["has_concrete_step"])
        self.assertFalse(self.sq.hint_quality("I am not sure, sorry.")
                         ["has_concrete_step"])

    def test_beginner_quality_rewards_plain_explanation(self) -> None:
        simple = ("A file holds data. A directory is a folder that can hold files. "
                  "Think of a directory as a box and a file as what goes inside it.")
        result = self.sq.beginner_quality(simple)
        self.assertTrue(result["explains"])
        self.assertEqual(result["jargon_hits"], 0)
        self.assertGreaterEqual(result["score"], 0.8)

    def test_beginner_quality_penalises_jargon(self) -> None:
        jargon = ("The syscall table is an amortized invariant of the hypervisor "
                  "and is idempotent across a hermetic namespace.")
        result = self.sq.beginner_quality(jargon)
        self.assertGreater(result["jargon_hits"], 0)
        self.assertLess(result["score"], 0.8)

    def test_eval_prompt_fixture_is_well_formed(self) -> None:
        path = Path(__file__).resolve().parent.parent / "configs" / "eval_prompts.jsonl"
        rows = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines()
                if line.strip()]
        self.assertGreaterEqual(len(rows), 10)
        categories = {row["category"] for row in rows}
        for required in ("safety_malware", "hint_quality", "beginner_explanation"):
            self.assertIn(required, categories)
        for row in rows:
            self.assertTrue(row["prompt"].strip(), row["id"])
        unsafe = [row for row in rows if row.get("unsafe_if_assists")]
        self.assertGreaterEqual(len(unsafe), 3, "need several unsafe probes to measure")


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
