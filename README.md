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
This is not an officially supported Google product.

Warning: Wizard is a demo project. It is not production grade and should not be treated as such. We try to do as much testing as possible but you run the tool at your own risk.

Warning: Wizard generates draft descriptions for BigQuery tables and columns. These drafts **must be reviewed and explicitly accepted** through the Metadata Review UI before they replace or update existing descriptions. Use with caution.

# Metadata Wizard

Wizard leverages Large Language Models (LLMs) to automatically generate draft descriptions for BigQuery tables and columns, incorporating a human-in-the-loop review process before finalizing the metadata.
## Key Features:

* Automated Draft Generation: Reduces manual effort by generating initial descriptions for BigQuery tables and columns.
* Human-in-the-Loop Review: Provides a dedicated UI for reviewing, editing, commenting on, and accepting generated descriptions.
* Staging and Acceptance Workflow: Generated descriptions are held as 'drafts' until explicitly accepted by a user.
* Configurable Options: Allows users to specify what information should be used in the description generation process (e.g., lineage, data quality).
* External Documentation Integration: Can leverage external documentation (like a PDF) to enhance the generated descriptions.
* Comparison View: Allows side-by-side comparison (diff view) of current and draft descriptions.
* Rich Text Editing: Supports editing descriptions using a rich text editor.
* Regeneration Option: Users can mark items for regeneration if the draft is unsatisfactory.


## Here's how it works:

* Gathers Information: Wizard collects data about your BigQuery table, including its schema, sample data, data quality metrics, data profile information, and lineage information (optional). It can also incorporate external documentation if provided.
* Constructs a Prompt: Based on the gathered information and user-defined options, Wizard constructs a detailed prompt for the LLM. This prompt describes the table and requests a comprehensive description.
* LLM Inference: The constructed prompt is sent to a pre-selected LLM hosted on Vertex AI. The LLM processes the prompt and generates a descriptive text.
* Stages Draft Description: Wizard saves the LLM-generated description as a 'draft' associated with the corresponding BigQuery table or column.
* User Review and Acceptance: Users access the Metadata Review UI to examine the draft description. They can compare it with the current description, edit it, add comments, or mark it for regeneration.
* Updates Metadata upon Acceptance: Only after a user explicitly accepts a draft description in the UI does Wizard update the corresponding BigQuery table or column description (behavior like appending or replacing depends on configuration).


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
cd src/frontend/metadata-manager-app
npm install
npm start
```

## Metadata Review UI

The frontend application provides a dedicated interface for the human-in-the-loop review process. Key functionalities include:

*   **List View:** Browse all items (tables and columns) that have draft descriptions awaiting review. Shows basic information like name, type, and status.
*   **Review Mode:** View detailed information for a selected item.
    *   **Side-by-Side/Diff View:** Compare the existing description with the AI-generated draft description, highlighting differences.
    *   **Editing:** Modify the draft description using a plain text or rich text editor.
    *   **Acceptance:** Approve the draft description, making it the official metadata (subject to configured handling like 'append' or 'replace').
    *   **Comments:** Add comments or feedback to an item.
    *   **Regeneration:** Mark an item to be re-processed by the LLM if the current draft is unsuitable.
    *   **Navigation:** Easily move between items (Next/Previous table) and navigate between columns within a table.
*   **Caching and Preloading:** Implements caching and preloading strategies to improve performance and provide a smoother user experience during navigation.
*   **Refresh:** Manually refresh the list of review items or the details of the currently viewed item.



## Providing external documentation

External documentation can be provided in two formats:
* CSV file with links to PDF documents
* PDF document

### CSV file with links to PDF documents
File should have two columns:
* table_id
* documentation_uri
columns separated by commas.
Each row in the file represents a table.

File should be stored in Google Cloud Storage.

example csv file content: 

```
car_crashes,gs://wizard-documents/Data 360 Documentation - Dataflix - olderdocs.pdf
accident,gs://wizard-documents/Data 360 Documentation - Dataflix - olderdocs.pdf
```

### PDF document

Can be used as a reference for the LLM to generate more accurate descriptions when generating single table-level descriptions.
File should be stored in Google Cloud Storage.
example file path:

```
gs://wizard-documents/Data 360 Documentation - Dataflix - olderdocs.pdf
```

## Using CLI and example CLI commands

```bash
metadata-wizard --help
```
To use CLI you need to have installed metadata-wizard package. The CLI generates **draft** descriptions that need to be reviewed and accepted via the Metadata Review UI. To use local deployment you need to have backend_apis deployed. For local deployment use --debug TRUE flag.


Calling metadata wizard CLI to generate **draft** metadata for all tables and all columns in a dataset:

```bash
metadata-wizard --service localhost:8000 --scope dataset --dataplex_project_id <dataplex_project_id> --llm_location <llm_location> --dataplex_location <dataplex_location> --table_project_id <table_project_id> --table_dataset_id <table_dataset_id> --strategy <strategy> --use_lineage_tables TRUE  --use_lineage_processes TRUE --use_profile TRUE --use_data_quality TRUE --use_ext_documents TRUE --stage_for_review TRUE
```



### Generate Basic Table Description
Generate **draft** metadata for a single table:
```bash
metadata-wizard --service localhost:8000 \
  --scope table \
  --dataplex_project_id <project_id> \
  --llm_location us-central1 \
  --dataplex_location us-central1 \
  --table_project_id <project_id> \
  --table_dataset_id <dataset_id> \
  --table_id <table_id> \
  --debug TRUE \
  --stage_for_review TRUE
```

### Dataset-Level Description with PDF Documentation
Generate **draft** metadata for all tables in a dataset using a CSV file with links to PDF document as reference:
```bash
metadata-wizard --service localhost:8000 \
  --scope dataset \
  --dataplex_project_id <project_id> \
  --llm_location us-central1 \
  --dataplex_location us-central1 \
  --table_project_id <project_id> \
  --table_dataset_id <dataset_id> \
  --documentation_csv_uri "gs://your-bucket/your-documentation.csv" \
  --strategy NAIVE \
  --debug TRUE \
  --stage_for_review TRUE
```

### Dataset Columns with CSV Documentation
Generate **draft** column descriptions for all tables in a dataset using a CSV mapping file:
```bash
metadata-wizard --service localhost:8000 \
  --scope dataset_columns \
  --dataplex_project_id <project_id> \
  --llm_location us-central1 \
  --dataplex_location us-central1 \
  --table_project_id <project_id> \
  --table_dataset_id <dataset_id> \
  --documentation_csv_uri "gs://your-bucket/column-mappings.csv" \
  --strategy DOCUMENTED \
  --debug TRUE \
  --stage_for_review TRUE
```

### Comprehensive Table and Column Analysis
Generate **draft** descriptions using all available information sources:
```bash
metadata-wizard --service localhost:8000 \
  --scope columns \
  --dataplex_project_id <project_id> \
  --llm_location us-central1 \
  --dataplex_location us-central1 \
  --table_project_id <project_id> \
  --table_dataset_id <dataset_id> \
  --table_id <table_id> \
  --documentation_uri "gs://your-bucket/documentation.pdf" \
  --use_lineage_tables TRUE \
  --use_lineage_processes TRUE \
  --use_profile TRUE \
  --use_data_quality TRUE \
  --use_ext_documents TRUE \
  --debug TRUE \
  --stage_for_review TRUE
```

# Customizing metadata generation
All prompt templates are located in **constants.toml** file in metadata package. Modify them to generate expected shape of metadata. 
