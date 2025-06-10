#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
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
"""
"""Dataplex Utils Metadata Wizard CLI test suite
"""

# Standard imports
import logging
import pytest
import random
import string
import subprocess
import os
import sys

# Cloud imports
from google.cloud import bigquery
from google.cloud.exceptions import NotFound


class TestMetadataWizardCLI:
    @pytest.fixture(autouse=True)
    def setup_and_teardown(
        self, project_id, llm_location, dataplex_location, documentation_uri, request
    ):
        self._project_id = project_id
        self._llm_location = llm_location
        self._dataplex_location = dataplex_location
        self._documentation_uri = documentation_uri

        pattern = string.ascii_lowercase + string.digits
        dataset_random_name = "".join(random.sample(pattern, 10))
        table_random_name = "".join(random.sample(pattern, 10))
        self._create_dataset(project_id, dataset_random_name)
        self._create_table(project_id, dataset_random_name, table_random_name)
        self._table_id = table_random_name
        self._dataset_id = dataset_random_name
        self._table_fqn = f"{project_id}.{dataset_random_name}.{table_random_name}"

        # Get path to the CLI script
        root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
        self._cli_path = os.path.join(root_dir, 'src', 'cli', 'metadata_wizard_cli', 'cli.py')

        yield  # This is where the test function will be executed

        # Teardown
        self._delete_table_and_dataset()

    def _delete_table_and_dataset(self):
        bq_client = bigquery.Client()
        table_ref = bq_client.dataset(self._dataset_id).table(self._table_id)
        dataset_ref = bq_client.dataset(self._dataset_id)

        try:
            bq_client.delete_table(table_ref)
            logging.info(f"Table {self._table_fqn} deleted successfully.")
        except NotFound:
            logging.warning(f"Table {self._table_fqn} not found. Skipping deletion.")

        try:
            bq_client.delete_dataset(dataset_ref, delete_contents=True, not_found_ok=True)
            logging.info(f"Dataset {self._dataset_id} deleted successfully.")
        except NotFound:
            logging.warning(f"Dataset {self._dataset_id} not found. Skipping deletion.")

    def _create_dataset(self, project_id, dataset_random_name):
        bq_client = bigquery.Client()
        dataset = bigquery.Dataset(f"{project_id}.{dataset_random_name}")
        dataset = bq_client.create_dataset(dataset)

    def _create_table(self, project_id, dataset_random_name, table_random_name):
        bq_client = bigquery.Client()
        schema = [
            bigquery.SchemaField("foo", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("bar", "INTEGER", mode="REQUIRED"),
        ]
        table = bigquery.Table(
            f"{project_id}.{dataset_random_name}.{table_random_name}", schema=schema
        )
        table = bq_client.create_table(table)

    def test_cli_table_description(self):
        """Test generating table description via CLI"""
        command = [
            'python', self._cli_path,
            '--service', 'local',  # Use local library instead of API service
            '--scope', 'table',
            '--dataplex_project_id', self._project_id,
            '--llm_location', self._llm_location,
            '--dataplex_location', self._dataplex_location,
            '--table_project_id', self._project_id,
            '--table_dataset_id', self._dataset_id,
            '--table_id', self._table_id,
            '--debug', 'TRUE'
        ]
        
        result = subprocess.run(command, capture_output=True, text=True)
        
        print("Executed command:", " ".join(command))
        print("STDOUT:")
        print(result.stdout)
        print("STDERR:")
        print(result.stderr)
        
        assert result.returncode == 0
        assert 'Table description generated successfully' in result.stdout
        
        # Verify that the description was applied
        bq_client = bigquery.Client()
        table_ref = bq_client.dataset(self._dataset_id).table(self._table_id)
        table = bq_client.get_table(table_ref)
        assert table.description is not None and table.description != ""

    def test_cli_column_descriptions(self):
        """Test generating column descriptions via CLI"""
        command = [
            'python', self._cli_path,
            '--service', 'local',  # Use local library instead of API service
            '--scope', 'columns',
            '--dataplex_project_id', self._project_id,
            '--llm_location', self._llm_location,
            '--dataplex_location', self._dataplex_location,
            '--table_project_id', self._project_id,
            '--table_dataset_id', self._dataset_id,
            '--table_id', self._table_id,
            '--debug', 'TRUE'
        ]
        
        result = subprocess.run(command, capture_output=True, text=True)
        
        print("Executed command:", " ".join(command))
        print("STDOUT:")
        print(result.stdout)
        print("STDERR:")
        print(result.stderr)
        
        assert result.returncode == 0
        assert 'Column descriptions generated successfully' in result.stdout
        
        # Verify that column descriptions were applied
        bq_client = bigquery.Client()
        table_ref = bq_client.dataset(self._dataset_id).table(self._table_id)
        table = bq_client.get_table(table_ref)
        for field in table.schema:
            assert field.description is not None and field.description != ""

    def test_cli_dataset_descriptions(self):
        """Test generating descriptions for all tables in a dataset via CLI"""
        command = [
            'python', self._cli_path,
            '--service', 'local',  # Use local library instead of API service
            '--scope', 'dataset',
            '--dataplex_project_id', self._project_id,
            '--llm_location', self._llm_location,
            '--dataplex_location', self._dataplex_location,
            '--dataset_project_id', self._project_id,
            '--dataset_id', self._dataset_id,
            '--debug', 'TRUE'
        ]
        
        result = subprocess.run(command, capture_output=True, text=True)
        
        print("Executed command:", " ".join(command))
        print("STDOUT:")
        print(result.stdout)
        print("STDERR:")
        print(result.stderr)
        
        assert result.returncode == 0
        assert 'Dataset tables descriptions generated successfully' in result.stdout
        
        # Verify that the table description was applied
        bq_client = bigquery.Client()
        table_ref = bq_client.dataset(self._dataset_id).table(self._table_id)
        table = bq_client.get_table(table_ref)
        assert table.description is not None and table.description != ""

    def test_cli_with_documentation(self):
        """Test generating descriptions with documentation URI"""
        # Skip if documentation URI is not provided
        if not self._documentation_uri or self._documentation_uri == "PDF Uris":
            pytest.skip("Documentation URI not provided")
            
        command = [
            'python', self._cli_path,
            '--service', 'local',  # Use local library instead of API service
            '--scope', 'table',
            '--dataplex_project_id', self._project_id,
            '--llm_location', self._llm_location,
            '--dataplex_location', self._dataplex_location,
            '--table_project_id', self._project_id,
            '--table_dataset_id', self._dataset_id,
            '--table_id', self._table_id,
            '--documentation_uri', self._documentation_uri,
            '--debug', 'TRUE'
        ]
        
        result = subprocess.run(command, capture_output=True, text=True)
        
        print("Executed command:", " ".join(command))
        print("STDOUT:")
        print(result.stdout)
        print("STDERR:")
        print(result.stderr)
        
        assert result.returncode == 0
        assert 'Table description generated successfully' in result.stdout
        
        # Verify that the description was applied
        bq_client = bigquery.Client()
        table_ref = bq_client.dataset(self._dataset_id).table(self._table_id)
        table = bq_client.get_table(table_ref)
        assert table.description is not None and table.description != "" 