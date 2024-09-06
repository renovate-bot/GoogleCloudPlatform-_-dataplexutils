# Copyright 2024 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.



import subprocess
import pytest
from google.cloud import bigquery
from dataplexutils.metadata.wizard import Client, ClientOptions



@pytest.fixture(scope="module")
def test_params(request):
    return {
        "project_id": request.config.getoption("--project_id"),
        "llm_location": request.config.getoption("--llm_location"),
        "dataplex_location": request.config.getoption("--dataplex_location"),
    }

@pytest.fixture(scope="module")
def bq_client(test_params):
    return bigquery.Client(project=test_params["project_id"])

@pytest.fixture(scope="module")
def test_dataset(bq_client, test_params):
    dataset_id = f"{test_params['project_id']}.test_dataset"
    dataset = bigquery.Dataset(dataset_id)
    dataset = bq_client.create_dataset(dataset, exists_ok=True)
    
    yield dataset
    
    bq_client.delete_dataset(dataset, delete_contents=True, not_found_ok=True)

@pytest.fixture(scope="module")
def test_table(bq_client, test_dataset):
    table_id = f"{test_dataset.project}.{test_dataset.dataset_id}.test_table"
    schema = [
        bigquery.SchemaField("name", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("age", "INTEGER", mode="REQUIRED"),
    ]
    table = bigquery.Table(table_id, schema=schema)
    table = bq_client.create_table(table, exists_ok=True)
    
    yield table
    
    bq_client.delete_table(table, not_found_ok=True)

def test_cli_generate_table_description(test_params, test_table):
    # Run the CLI command
    command = [
        'python', 'src/cli/metadata_wizard_cli/cli.py',
        '--service', 'http://localhost:8000',  # Adjust this URL if needed
        '--scope', 'table',
        '--dataplex_project_id', test_params['project_id'],
        '--llm_location', test_params['llm_location'],
        '--dataplex_location', test_params['dataplex_location'],
        '--table_project_id', test_params['project_id'],
        '--table_dataset_id', test_table.dataset_id,
        '--table_id', test_table.table_id,
        '--debug','TRUE'
    ]
    result = subprocess.run(command, capture_output=True, text=True)
    
    print("Executed command:", " ".join(command))
    print("STDOUT:")
    print(result.stdout)
    print("STDERR:")
    print(result.stderr)

    assert 'Table description generated successfully' in result.stdout

def test_api_generate_table_description(test_params, test_table):
    from fastapi.testclient import TestClient
    import sys
    import os

    # Add the path to the directory containing main.py
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src', 'backend_apis')))

    from main import app

    client = TestClient(app)
    response = client.post('/generate_table_description', json={
        'client_options_settings': {
            'use_lineage_tables': True,
            'use_lineage_processes': True,
            'use_profile': True,
            'use_data_quality': True,
            'use_ext_documents': False
        },
        'client_settings': {
            'project_id': test_params['project_id'],
            'llm_location': test_params['llm_location'],
            'dataplex_location': test_params['dataplex_location']
        },
        'table_settings': {
            'project_id': test_params['project_id'],
            'dataset_id': test_table.dataset_id,
            'table_id': test_table.table_id,
            'documentation_uri': ''
        }
    })

    assert response.status_code == 200
    assert response.json() == {'message': 'Table description generated successfully'}

def test_end_to_end_table_description(test_params, test_table, bq_client):
    # Create a real Client instance
    client_options = ClientOptions(
        use_lineage_tables=True,
        use_lineage_processes=True,
        use_profile=True,
        use_data_quality=True,
        use_ext_documents=False
    )
    client = Client(
        project_id=test_params['project_id'],
        llm_location=test_params['llm_location'],
        dataplex_location=test_params['dataplex_location'],
        client_options=client_options
    )

    # Generate the table description
    client.generate_table_description(f"{test_params['project_id']}.{test_table.dataset_id}.{test_table.table_id}")

    # Check if the description was updated
    updated_table = bq_client.get_table(test_table)
    assert updated_table.description is not None and updated_table.description != ""
