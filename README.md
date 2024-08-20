Copyright 2024 Google LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    https://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

# Please read these Warnings
Warning: Wizard is a demo project. It is not production grade and should not be treated as such. We try to do as much testing as possible but you run the tool at your own risk.

Warning: Wizard will overwrite and replace descriptions of  BigQuery tables and columns it's asked to describe. Use with caution.

# Metadata Wizard

Wizard leverages Large Language Models (LLMs) to automatically generate descriptions for BigQuery tables and columns.
## Key Features:

* Automated Metadata Generation: Reduces manual effort in documenting BigQuery tables and columns.
* Configurable Options: Allows users to specify what information should be used in the description generation process (e.g., lineage, data quality).
* External Documentation Integration: Can leverage external documentation (like a PDF) to enhance the generated descriptions.


## Here's how it works:

* Gathers Information: Wizard collects data about your BigQuery table, including its schema, sample data, data quality metrics, data profile information, and lineage information (optional). It can also incorporate external documentation if provided.
* Constructs a Prompt: Based on the gathered information and user-defined options, Wizard constructs a detailed prompt for the LLM. This prompt describes the table and requests a comprehensive description.
* LLM Inference: The constructed prompt is sent to a pre-selected LLM hosted on Vertex AI. The LLM processes the prompt and generates a descriptive text.
Updates Metadata: Wizard takes the LLM-generated description and updates the corresponding BigQuery table or column description.


## Build solution

Build python package

```bash
src/package/build_install_package.sh
```

Try package on notebook located at `notebooks/metadata_wizard_demo.ipynb`

(Optional) Build service

```bash
src/backend_apis/build_deploy_cloud.sh
```

(Optional) Install CLI

```bash
src/cli/install_cli.sh
```

(Optional) Test frontend

```bash
src/frontend/metadata-wizard-app/build_local.sh
```
