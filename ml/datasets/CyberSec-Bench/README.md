---
language:
- en
- fr
license: apache-2.0
task_categories:
- question-answering
- text-generation
tags:
- cybersecurity
- benchmark
- evaluation
- infosec
- compliance
- pentesting
- forensics
- cloud-security
- MITRE-ATT&CK
- OWASP
- ISO-27001
- GDPR
- NIS2
- DORA
- AI-Act
pretty_name: CyberSec-Bench
size_categories:
- n<1K
configs:
- config_name: default
  data_files:
  - split: test
    path: cybersec_bench.jsonl
dataset_info:
  features:
  - name: id
    dtype: string
  - name: question
    dtype: string
  - name: category
    dtype: string
  - name: subcategory
    dtype: string
  - name: difficulty
    dtype: string
  - name: reference_answer
    dtype: string
  - name: language
    dtype: string
  - name: source
    dtype: string
  splits:
  - name: test
    num_examples: 200
---

# CyberSec-Bench: Comprehensive Cybersecurity Benchmark Evaluation Dataset

## Overview

**CyberSec-Bench** is a bilingual (English/French) benchmark dataset designed to evaluate the cybersecurity knowledge of Large Language Models (LLMs) and AI systems. The dataset contains **200 expert-crafted questions** spanning five critical domains of cybersecurity, with detailed reference answers for each question.

This benchmark tests **real-world cybersecurity knowledge** at professional certification levels (CISSP, OSCP, GCFE, CCSP equivalent), not trivial or surface-level concepts.

## Dataset Statistics

| Metric | Value |
|--------|-------|
| Total questions | 200 |
| Categories | 5 |
| Languages | English (100), French (100) |
| Difficulty levels | Easy (53), Medium (92), Hard (55) |
| Avg. reference answer length | 150-300 words |
| Format | JSONL |

## Categories

### 1. Compliance (40 questions)
Regulatory frameworks and security standards critical for organizational governance.
- **ISO 27001:2022** - ISMS requirements, certification, controls, auditing
- **GDPR/RGPD** - Data protection principles, rights, DPO, international transfers
- **NIS2 Directive** - Essential/important entities, incident reporting, supply chain
- **DORA** - Digital operational resilience for financial sector, TLPT, ICT risk
- **EU AI Act** - Risk classification, high-risk obligations, GPAI models, sandboxes

### 2. Offensive Security (40 questions)
Attack techniques and penetration testing methodologies for red team operations.
- **MITRE ATT&CK** - TTPs including T1557, T1550, T1558, T1053, T1071
- **OWASP Top 10** - XSS, SSRF, injection, broken access control, API security
- **Pentesting** - AD attacks, web app testing, wireless, cloud pentesting
- **Exploitation Techniques** - ADCS attacks, EDR evasion, container escape, buffer overflows

### 3. Defensive Security (40 questions)
Blue team operations, detection engineering, and security architecture.
- **SOC Operations** - Analyst tiers, SIEM architecture, SOAR playbooks, EDR/XDR
- **Threat Hunting** - Hypothesis-driven hunting, SIGMA rules, YARA rules, D3FEND
- **Incident Response** - NIST lifecycle, ransomware IR, BEC response, tabletop exercises
- **Security Architecture** - Zero Trust, DLP, network segmentation, email security

### 4. Forensics & IR (40 questions)
Digital forensics investigation and evidence analysis techniques.
- **Digital Forensics** - Windows/Linux/macOS/mobile forensics, acquisition methods
- **Evidence Analysis** - Memory forensics (Volatility), malware analysis, email forensics
- **Timeline Reconstruction** - Super timelines, MFT analysis, Prefetch, Registry artifacts
- **Cloud Forensics** - AWS/Azure/GCP investigation, container forensics

### 5. Cloud & Infrastructure Security (40 questions)
Cloud-native security and modern infrastructure protection.
- **AWS Security** - IAM, S3, Lambda, GuardDuty, CloudTrail, Well-Architected
- **Azure Security** - Entra ID, Conditional Access, AKS, VNet security
- **GCP Security** - BeyondCorp, Chronicle, VPC Service Controls, CNAPP
- **Kubernetes Security** - RBAC, Network Policies, Pod Security, admission control
- **DevSecOps** - CI/CD security, IaC scanning, service mesh, GitOps security

## Schema

Each question entry contains the following fields:

```json
{
  "id": "COMP-001",
  "question": "The question text in English or French",
  "category": "Compliance | Offensive Security | Defensive Security | Forensics & IR | Cloud & Infrastructure",
  "subcategory": "More specific topic area",
  "difficulty": "easy | medium | hard",
  "reference_answer": "Detailed expected answer (150-300 words)",
  "language": "en | fr",
  "source": "Relevant framework, standard, or reference"
}
```

## Intended Use

### Evaluation of LLMs
Use this benchmark to assess how well language models understand and can explain cybersecurity concepts across multiple domains and difficulty levels.

### Evaluation Metrics
- **Accuracy**: Compare model responses against reference answers for factual correctness
- **Completeness**: Assess whether key concepts from the reference answer are covered
- **Bilingual capability**: Evaluate performance across English and French questions
- **Domain expertise**: Measure performance per category to identify strengths and weaknesses

### Suggested Evaluation Approach
1. Present each question to the model
2. Compare the generated answer with the reference answer using:
   - Automated metrics (ROUGE, BERTScore, semantic similarity)
   - LLM-as-judge evaluation for factual accuracy
   - Human expert evaluation for a subset
3. Report scores by category, difficulty, and language

## Difficulty Distribution

| Difficulty | Count | Description |
|-----------|-------|-------------|
| Easy | 53 | Foundational concepts, standard procedures |
| Medium | 92 | Applied knowledge, multi-step reasoning |
| Hard | 55 | Expert-level analysis, advanced techniques |

## Referenced Standards and Frameworks

- ISO/IEC 27001:2022, ISO/IEC 27701:2019
- GDPR (Regulation EU 2016/679)
- NIS2 Directive (EU 2022/2555)
- DORA (EU 2022/2554)
- EU AI Act (EU 2024/1689)
- MITRE ATT&CK, MITRE D3FEND
- OWASP Top 10 2021, OWASP API Security Top 10 2023
- NIST SP 800-61r2, 800-86, 800-207, 800-190
- CIS Benchmarks (AWS, Azure, GCP, Kubernetes, Docker)
- AWS Well-Architected Framework
- SANS Digital Forensics, SANS FOR500/508/610

## Loading the Dataset

```python
from datasets import load_dataset

dataset = load_dataset("AYI-NEDJIMI/CyberSec-Bench", split="test")

# Filter by category
compliance = dataset.filter(lambda x: x["category"] == "Compliance")

# Filter by language
french_questions = dataset.filter(lambda x: x["language"] == "fr")

# Filter by difficulty
hard_questions = dataset.filter(lambda x: x["difficulty"] == "hard")
```

## Limitations

- Reference answers represent best-practice knowledge as of early 2025. Cybersecurity is a rapidly evolving field, and some answers may require updates as new standards, techniques, and vulnerabilities emerge.
- The bilingual nature (EN/FR) means evaluation must account for language-specific nuances.
- Some questions reference specific tool versions that may change over time.
- The dataset focuses on knowledge evaluation, not practical skills assessment.

## Citation

If you use this dataset in your research, please cite:

```bibtex
@dataset{cybersec_bench_2025,
  title={CyberSec-Bench: Comprehensive Cybersecurity Benchmark Evaluation Dataset},
  author={AYI-NEDJIMI},
  year={2025},
  publisher={Hugging Face},
  url={https://huggingface.co/datasets/AYI-NEDJIMI/CyberSec-Bench}
}
```

## License

This dataset is released under the Apache 2.0 License.
