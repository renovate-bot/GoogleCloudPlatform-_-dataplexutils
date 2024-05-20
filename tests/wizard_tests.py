#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""Dataplex Utils Metadata Wizard test suite
   2024 Google
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
            documentation_uri=documentation_uri,
            client_options=wizard_client_options,
        )

    def teardown_class(self):
        pass

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
