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
    def setup_class(self, project_id, location):
        self._project_id = project_id
        self._location = location
        pattern = string.ascii_lowercase+string.digits
        dataset_random_name = ''.join(random.sample(pattern, 10))
        table_random_name = ''.join(random.sample(pattern, 10))
        self._create_dataset(project_id, dataset_random_name)
        self._create_table(project_id, dataset_random_name,
                           table_random_name)
        self._table_fqn = f"{project_id}.{dataset_random_name}.{table_random_name}"
        self._wizard_client = Client(
            project_id=project_id, location=location)

    def teardown_class(self):
        pass
        
    def _create_dataset(self, project_id, dataset_random_name):
        bq_client = bigquery.Client()
        dataset = bigquery.Dataset(f"{project_id}.{dataset_random_name}")
        dataset = bq_client.create_dataset(dataset)
        
    def _create_table(self, project_id, dataset_random_name,
                      table_random_name):
        bq_client = bigquery.Client()
        schema = [
            bigquery.SchemaField("foo", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("bar", "INTEGER", mode="REQUIRED"),
            ]
        table = bigquery.Table(f"{project_id}.{dataset_random_name}.{table_random_name}", schema=schema)
        table = bq_client.create_table(table)  
       
    def test_table_exists_true(self):
        self._wizard_client._table_exists(self._table_fqn)

    def test_table_exists_false(self):
        pattern = string.ascii_lowercase+string.digits
        dataset_random_name = ''.join(random.sample(pattern, 10))
        table_random_name = ''.join(random.sample(pattern, 10))
        with pytest.raises(NotFound):
            self._wizard_client._table_exists(
                f"{self._project_id}.{dataset_random_name}.{table_random_name}")

