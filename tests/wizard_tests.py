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
from dataplexutils.metadata.wizard import Client, ClientOptions


class TestMetadataWizardClient:
    @pytest.fixture(autouse=True)
    def setup_class(
        self, project_id, llm_location, dataplex_location, documentation_uri
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

        self._wizard_client_options = ClientOptions(
            use_lineage_tables=True,
            use_lineage_processes=True,
            use_profile=True,
            use_data_quality=True,
        )
        wizard_client_options = ClientOptions(
            use_lineage_tables=True,
            use_lineage_processes=True,
            use_profile=True,
            use_data_quality=True,
        )
        self._wizard_client_options = wizard_client_options
        self._wizard_client = Client(
            project_id=project_id,
            llm_location=llm_location,
            dataplex_location=dataplex_location,            
            client_options=wizard_client_options,
        )

    def teardown_class(self):
        bq_client = bigquery.Client()
        dataset_id = f"{self._project_id}.{self._dataset_id}"
        bq_client.delete_dataset(dataset_id, delete_contents=True, not_found_ok=True)     

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
        self._wizard_client._table_exists(self._table_fqn)

    def test_table_exists_false(self):
        pattern = string.ascii_lowercase + string.digits
        dataset_random_name = "".join(random.sample(pattern, 10))
        table_random_name = "".join(random.sample(pattern, 10))
        with pytest.raises(NotFound):
            self._wizard_client._table_exists(
                f"{self._project_id}.{dataset_random_name}.{table_random_name}"
            )

    def test_split_table_fqn(self):
        project_id, dataset_id, table_id = self._wizard_client._split_table_fqn(
            self._table_fqn
        )
        assert project_id == self._project_id
        assert dataset_id == self._dataset_id
        assert table_id == self._table_id

    def test_get_table_schema(self):
            schema, _ = self._wizard_client._get_table_schema(self._table_fqn)
            expected_schema = [
                {"name": "foo", "type": "STRING"},
                {"name": "bar", "type": "INTEGER"},
            ]
            assert schema == expected_schema

    def test_get_table_scan_reference(self):
        # Assuming no DataPlex scan exists for the test table
        scan_references = self._wizard_client._get_table_scan_reference(
            self._table_fqn
        )
        assert scan_references == []  # Or check for specific error handling

    def test_get_table_profile_quality(self):
        # Assuming no DataPlex scan exists for the test table
        profile_quality = self._wizard_client._get_table_profile_quality(
            False, self._table_fqn
        )
        assert profile_quality == {"data_profile": [], "data_quality": []}

    def test_get_table_sources_info(self):
        # Assuming no lineage information for the test table
        sources_info = self._wizard_client._get_table_sources_info(
            True, self._table_fqn
        )
        assert sources_info == []

    def test_get_job_sources(self):
        # Assuming no lineage information for the test table
        job_sources = self._wizard_client._get_job_sources(True, self._table_fqn)
        assert job_sources == []

    def test_get_table_description(self):
        description = self._wizard_client._get_table_description(self._table_fqn)
        assert description is None  # Or check for an empty string

    def test_update_table_bq_description(self):
        test_description = "Test description"
        self._wizard_client._update_table_bq_description(
            self._table_fqn, test_description
        )
        updated_description = self._wizard_client._get_table_description(
            self._table_fqn
        )
        assert updated_description == test_description

    def test_generate_table_description(self):
        # Test with valid table FQN
        self._wizard_client.generate_table_description(self._table_fqn)
        description = self._wizard_client._get_table_description(self._table_fqn)
        assert description is not None

        # Test with invalid table FQN
      #  with pytest.raises(NotFound):
     #       self._wizard_client.generate_table_description('invalid.table.fqn')

    def test_generate_columns_descriptions(self):
        # Test with valid table FQN
        self._wizard_client.generate_columns_descriptions(self._table_fqn)
        _, schema = self._wizard_client._get_table_schema(self._table_fqn)
        for column in schema:
            assert column.description is not None

        # Test with invalid table FQN
        with pytest.raises(Exception) as e:
            self._wizard_client.generate_columns_descriptions('invalid.table.fqn')
        assert f"Generation of column description table self._table_fqn failed." in str(e)
