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
"""Dataplex Utils Metadata Wizard test suite
"""

# OS Imports
import logging
import pytest
import random
import string

# Cloud imports
from google.cloud import bigquery
from google.cloud.exceptions import NotFound

# Package to test
from dataplexutils.metadata import Client, ClientOptions


class TestMetadataWizardClient:
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

        # Create client options with the updated parameters
        wizard_client_options = ClientOptions(
            use_lineage_tables=True,
            use_lineage_processes=True,
            use_profile=True,
            use_data_quality=True,
            use_ext_documents=False,
            persist_to_dataplex_catalog=True,
            stage_for_review=False
        )
        self._wizard_client_options = wizard_client_options
        
        # Create client with the updated parameters
        self._wizard_client = Client(
            project_id=project_id,
            llm_location=llm_location,
            dataplex_location=dataplex_location,            
            client_options=wizard_client_options,
        )

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

    def _insert_row(self, project_id, dataset_random_name, table_random_name):
        bq_client = bigquery.Client()
        table_ref = bq_client.dataset(dataset_random_name).table(table_random_name)
        table = bq_client.get_table(table_ref)  # API request

        row_to_insert = [
            ("test_string", 123),
        ]
        errors = bq_client.insert_rows(table, row_to_insert)  # API request
        assert errors == []

    def test_table_exists_true(self):
        # Test that the table exists
        assert self._wizard_client._bigquery_ops.table_exists(self._table_fqn) is None  # Returns None on success

    def test_table_exists_false(self):
        # Test that a non-existent table raises NotFound
        pattern = string.ascii_lowercase + string.digits
        dataset_random_name = "".join(random.sample(pattern, 10))
        table_random_name = "".join(random.sample(pattern, 10))
        with pytest.raises(NotFound):
            self._wizard_client._bigquery_ops.table_exists(
                f"{self._project_id}.{dataset_random_name}.{table_random_name}"
            )

    def test_split_table_fqn(self):
        # Test splitting a table FQN into its components
        project_id, dataset_id, table_id = self._wizard_client._utils.split_table_fqn(
            self._table_fqn
        )
        assert project_id == self._project_id
        assert dataset_id == self._dataset_id
        assert table_id == self._table_id

    def test_get_table_schema(self):
        # Test retrieving table schema
        schema, _ = self._wizard_client._bigquery_ops.get_table_schema(self._table_fqn)
        expected_schema = [
            {"name": "foo", "type": "STRING"},
            {"name": "bar", "type": "INTEGER"},
        ]
        assert schema == expected_schema

    def test_get_table_profile(self):
        # Test retrieving table profile
        table_profile = self._wizard_client._dataplex_ops.get_table_profile(
            True, self._table_fqn
        )
        # For testing purposes, just check the return structure
        assert isinstance(table_profile, dict) or table_profile == []

    def test_get_table_quality(self):
        # Test retrieving table quality
        table_quality = self._wizard_client._dataplex_ops.get_table_quality(
            True, self._table_fqn
        )
        # For testing purposes, just check the return structure
        assert isinstance(table_quality, dict) or table_quality == []

    def test_get_table_sources_info(self):
        # Test retrieving table sources info
        sources_info = self._wizard_client._dataplex_ops.get_table_sources_info(
            True, self._table_fqn
        )
        # For a new test table, there should be no sources
        assert sources_info == []

    def test_get_job_sources(self):
        # Test retrieving job sources
        job_sources = self._wizard_client._dataplex_ops.get_job_sources(
            True, self._table_fqn
        )
        # For a new test table, there should be no job sources
        assert job_sources == []

    def test_get_table_description(self):
        # Test retrieving table description
        description = self._wizard_client._bigquery_ops.get_table_description(self._table_fqn)
        # For a new test table, the description should be None or empty
        assert description is None or description == ""

    def test_update_table_description(self):
        # Test updating table description
        test_description = "Test description"
        self._wizard_client._bigquery_ops.update_table_description(
            self._table_fqn, test_description
        )
        updated_description = self._wizard_client._bigquery_ops.get_table_description(
            self._table_fqn
        )
        assert updated_description == test_description

    def test_generate_table_description(self):
        # Test generating table description
        self._wizard_client.generate_table_description(self._table_fqn)
        description = self._wizard_client._bigquery_ops.get_table_description(self._table_fqn)
        assert description is not None and description != ""

        # Test with invalid table FQN - commented out to avoid actual execution
        # Uncomment when ready to test with invalid tables
        # with pytest.raises(NotFound):
        #    self._wizard_client.generate_table_description('invalid.table.fqn')

    def test_generate_columns_descriptions(self):
        # Test generating column descriptions
        self._wizard_client.generate_columns_descriptions(self._table_fqn)
        
        # Get the table schema to check column descriptions
        bq_client = bigquery.Client()
        table = bq_client.get_table(self._table_fqn)
        schema = table.schema
        
        # Verify column descriptions were created
        for field in schema:
            assert field.description is not None and field.description != ""

        # Test with invalid table FQN
        with pytest.raises(NotFound):
            self._wizard_client.generate_columns_descriptions('invalid.table.fqn')
            
    def test_dataset_operations(self):
        # Test generate_dataset_tables_descriptions
        self._wizard_client.generate_dataset_tables_descriptions(f"{self._project_id}.{self._dataset_id}")
        
        # Verify table description was created
        description = self._wizard_client._bigquery_ops.get_table_description(self._table_fqn)
        assert description is not None and description != ""
        
    # New test for regeneration operations
    def test_regeneration_operations(self):
        # Generate initial description
        self._wizard_client.generate_table_description(self._table_fqn)
        
        # Mark for regeneration
        result = self._wizard_client._dataplex_ops.mark_table_for_regeneration(self._table_fqn)
        
        # Check if the table should be regenerated
        should_regenerate = self._wizard_client._dataplex_ops.check_if_table_should_be_regenerated(self._table_fqn)
        
        # Should be True if mark_table_for_regeneration worked properly
        assert should_regenerate is True
        
        # Regenerate the description
        self._wizard_client.generate_table_description(self._table_fqn)
        
        # Mark as regenerated
        self._wizard_client._dataplex_ops.mark_table_as_regenerated(self._table_fqn)
        
        # Check if it still needs to be regenerated
        should_regenerate = self._wizard_client._dataplex_ops.check_if_table_should_be_regenerated(self._table_fqn)
        
        # Should be False after marking as regenerated
        assert should_regenerate is False

