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
To use CLI you need to have installed metadata-wizard package. To use local deployment you need to have backend_apis deployed. For local deployment use --debug TRUE flag.


Calling metadata wizard CLI to generate metadata for all tables and all columns in a dataset:

```bash
metadata-wizard --service localhost:8000 --scope dataset --dataplex_project_id <dataplex_project_id> --llm_location <llm_location> --dataplex_location <dataplex_location> --table_project_id <table_project_id> --table_dataset_id <table_dataset_id> --strategy <strategy> --use_lineage_tables TRUE  --use_lineage_processes TRUE --use_profile TRUE --use_data_quality TRUE --use_ext_documents TRUE 
```



### Generate Basic Table Description
Generate metadata for a single table:
```bash
metadata-wizard --service localhost:8000 \
  --scope table \
  --dataplex_project_id <project_id> \
  --llm_location us-central1 \
  --dataplex_location us-central1 \
  --table_project_id <project_id> \
  --table_dataset_id <dataset_id> \
  --table_id <table_id> \
  --debug TRUE
```

### Dataset-Level Description with PDF Documentation
Generate metadata for all tables in a dataset using a CSV file with links to PDF document as reference:
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
  --debug TRUE
```

### Dataset Columns with CSV Documentation
Generate column descriptions for all tables in a dataset using a CSV mapping file:
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
  --debug TRUE
```

### Comprehensive Table and Column Analysis
Generate descriptions using all available information sources:
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
  --debug TRUE
```

# Customizing metadata generation
All prompt templates are located in **constants.toml** file in metadata package. Modify them to generate expected shape of metadata. 
