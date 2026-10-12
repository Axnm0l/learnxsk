---
license: cc-by-nc-sa-4.0
task_categories:
- zero-shot-classification
- question-answering
- text-classification
language:
- en
tags:
- cti
- cyber threat intelligence
- llm
pretty_name: CTIBench
size_categories:
- 1K<n<10K


configs:
- config_name: cti-mcq
  data_files: 
    - split: test
      path: "cti-mcq.tsv"
  sep: "\t"
- config_name: cti-rcm
  data_files: 
    - split: test
      path: "cti-rcm.tsv"
  sep: "\t"
- config_name: cti-vsp
  data_files: 
    - split: test
      path: "cti-vsp.tsv"
  sep: "\t"
- config_name: cti-taa
  data_files: 
    - split: test
      path: "cti-taa.tsv"
  sep: "\t"
- config_name: cti-ate
  data_files: 
    - split: test
      path: "cti-ate.tsv"
  sep: "\t"
- config_name: cti-rcm-2021
  data_files: 
    - split: test
      path: "cti-rcm-2021.tsv"
  sep: "\t"

---
# Dataset Card for CTIBench
<!-- Provide a quick summary of the dataset. -->

A set of benchmark tasks designed to evaluate large language models (LLMs) on cyber threat intelligence (CTI) tasks.

## Dataset Details

### Dataset Description

<!-- Provide a longer summary of what this dataset is. -->

CTIBench is a comprehensive suite of benchmark tasks and datasets designed to evaluate LLMs in the field of CTI.

Components:
- CTI-MCQ: A knowledge evaluation dataset with multiple-choice questions to assess the LLMs' understanding of CTI standards, threats, detection strategies, mitigation plans, and best practices. This dataset is built using authoritative sources and standards within the CTI domain, including NIST, MITRE, and GDPR.
- CTI-RCM: A practical task that involves mapping Common Vulnerabilities and Exposures (CVE) descriptions to Common Weakness Enumeration (CWE) categories. This task evaluates the LLMs' ability to understand and classify cyber threats.
- CTI-VSP: Another practical task that requires calculating the Common Vulnerability Scoring System (CVSS) scores. This task assesses the LLMs' ability to evaluate the severity of cyber vulnerabilities.
- CTI-TAA: A task that involves analyzing publicly available threat reports and attributing them to specific threat actors or malware families. This task tests the LLMs' capability to understand historical cyber threat behavior and identify meaningful correlations.

- **Curated by:** Md Tanvirul Alam & Dipkamal Bhusal (RIT)

<!--
- **Funded by [optional]:** [More Information Needed]
- **Shared by [optional]:** [More Information Needed]
- **Language(s) (NLP):** [More Information Needed]
- **License:** [More Information Needed]
-->

### Dataset Sources

<!-- Provide the basic links for the dataset. -->

**Repository:** https://github.com/xashru/cti-bench

<!--
- **Paper [optional]:** [More Information Needed]
- **Demo [optional]:** [More Information Needed]
-->

## Uses

<!-- Address questions around how the dataset is intended to be used. -->

CTIBench is designed to provide a comprehensive evaluation framework for large language models (LLMs) within the domain of cyber threat intelligence (CTI). 
Dataset designed in CTIBench assess the understanding of CTI standards, threats, detection strategies, mitigation plans, and best practices by LLMs, 
and evaluates the LLMs' ability to understand, and analyze about cyber threats and vulnerabilities.
<!--
### Direct Use

This section describes suitable use cases for the dataset. 

[More Information Needed]
-->

<!--
### Out-of-Scope Use -->

<!-- This section addresses misuse, malicious use, and uses that the dataset will not work well for. -->

<!--
[More Information Needed]
-->

## Dataset Structure

<!-- This section provides a description of the dataset fields, and additional information about the dataset structure such as criteria used to create the splits, relationships between data points, etc. -->

The dataset consists of 5 TSV files, each corresponding to a different task. Each TSV file contains a "Prompt" column used to pose questions to the LLM. 
Most files also include a "GT" column that contains the ground truth for the questions, except for "cti-taa.tsv". 
The evaluation scripts for the different tasks are available in the associated GitHub repository.

## Dataset Creation

### Curation Rationale

<!-- Motivation for the creation of this dataset. -->

This dataset was curated to evaluate the ability of LLMs to understand and analyze various aspects of open-source CTI.

### Source Data

<!-- 
This section describes the source data (e.g. news text and headlines, social media posts, translated sentences, ...). 
-->

The dataset includes URLs indicating the sources from which the data was collected.

<!--
#### Data Collection and Processing 

This section describes the data collection and processing process such as data selection criteria, filtering and normalization methods, tools and libraries used, etc. 

[More Information Needed]
-->

<!--
#### Who are the source data producers? 

This section describes the people or systems who originally created the data. It should also include self-reported demographic or identity information for the source data creators if this information is available. 

[More Information Needed]
-->

#### Personal and Sensitive Information

<!-- 
State whether the dataset contains data that might be considered personal, sensitive, or private (e.g., data that reveals addresses, uniquely identifiable names or aliases, racial or ethnic origins, sexual orientations, religious beliefs, political opinions, financial or health data, etc.). If efforts were made to anonymize the data, describe the anonymization process. 
-->

The dataset does not contain any personal or sensitive information.

<!--
## Bias, Risks, and Limitations

This section is meant to convey both technical and sociotechnical limitations.

[More Information Needed]
-->

<!--
### Recommendations


This section is meant to convey recommendations with respect to the bias, risk, and technical limitations.

Users should be made aware of the risks, biases and limitations of the dataset. More information needed for further recommendations.
-->


## Citation

The paper can be found at: https://arxiv.org/abs/2406.07599

**BibTeX:**

```bibtex
@misc{alam2024ctibench,
      title={CTIBench: A Benchmark for Evaluating LLMs in Cyber Threat Intelligence}, 
      author={Md Tanvirul Alam and Dipkamal Bhushal and Le Nguyen and Nidhi Rastogi},
      year={2024},
      eprint={2406.07599},
      archivePrefix={arXiv},
      primaryClass={cs.CR}
}
```

<!--

**APA:**

[More Information Needed]
-->

<!--
## Glossary [optional]

If relevant, include terms and calculations in this section that can help readers understand the dataset or dataset card.

[More Information Needed]
-->

<!--
## More Information [optional]

[More Information Needed] 
-->

<!--
## Dataset Card Authors [optional]

[More Information Needed]
-->


## Dataset Card Contact

Md Tanvirul Alam (ma8235 @ rit . edu)
