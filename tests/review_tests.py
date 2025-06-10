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
"""Dataplex Utils Metadata Wizard review operations test suite
"""

# OS Imports
import logging
import pytest
import random
import string
import time

# Cloud imports
from google.cloud import bigquery
from google.cloud.exceptions import NotFound

# Package to test
from dataplexutils.metadata import Client, ClientOptions


class TestReviewOperations:
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

        # Create client options with staging for review enabled
        wizard_client_options = ClientOptions(
            use_lineage_tables=True,
            use_lineage_processes=True,
            use_profile=True,
            use_data_quality=True,
            use_ext_documents=False,
            persist_to_dataplex_catalog=True,
            stage_for_review=True  # Enable staging for review
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

    def test_review_table_description(self):
        """Test the table description review workflow"""
        # Generate a table description that will be staged for review
        self._wizard_client.generate_table_description(self._table_fqn)
        
        # Add a comment to the draft description
        comment = "This is a test comment for the table review"
        result = self._wizard_client._review_ops.add_comment_to_table_draft_description(self._table_fqn, comment)
        assert result is not None
        
        # Get the comments added to the table draft description
        comments = self._wizard_client._review_ops.get_comments_to_table_draft_description(self._table_fqn)
        assert len(comments) > 0
        assert comment in comments
        
        # Get the details of the review item
        review_item = self._wizard_client._review_ops.get_review_item_details(self._table_fqn)
        assert review_item is not None
        
        # Accept the table draft description
        result = self._wizard_client._dataplex_ops.accept_table_draft_description(self._table_fqn)
        assert result is not None
        
        # Verify that the description was applied to BigQuery
        bq_client = bigquery.Client()
        table_ref = bq_client.dataset(self._dataset_id).table(self._table_id)
        table = bq_client.get_table(table_ref)
        assert table.description is not None and table.description != ""

    def test_review_column_description(self):
        """Test the column description review workflow"""
        # Generate column descriptions that will be staged for review
        self._wizard_client.generate_columns_descriptions(self._table_fqn)
        
        # Wait a moment for the descriptions to be processed
        time.sleep(1)
        
        # Add a comment to the first column's draft description
        column_name = "foo"
        comment = "This is a test comment for the column review"
        result = self._wizard_client._review_ops.add_comment_to_column_draft_description(self._table_fqn, column_name, comment)
        assert result is not None
        
        # Get the details of the column review item
        review_item = self._wizard_client._review_ops.get_review_item_details(self._table_fqn, column_name)
        assert review_item is not None
        
        # Accept the column draft description
        result = self._wizard_client._dataplex_ops.accept_column_draft_description(self._table_fqn, column_name)
        assert result is not None
        
        # Verify that the column description was applied
        bq_client = bigquery.Client()
        table_ref = bq_client.dataset(self._dataset_id).table(self._table_id)
        table = bq_client.get_table(table_ref)
        
        for field in table.schema:
            if field.name == column_name:
                assert field.description is not None and field.description != ""
                break

    def test_mark_for_regeneration(self):
        """Test marking items for regeneration"""
        # Generate a table description
        self._wizard_client.generate_table_description(self._table_fqn)
        
        # Mark the table for regeneration
        result = self._wizard_client._dataplex_ops.mark_table_for_regeneration(self._table_fqn)
        assert result is not None
        
        # Verify table is marked for regeneration
        should_regenerate = self._wizard_client._dataplex_ops.check_if_table_should_be_regenerated(self._table_fqn)
        assert should_regenerate is True
        
        # Generate column descriptions 
        self._wizard_client.generate_columns_descriptions(self._table_fqn)
        
        # Mark a column for regeneration
        column_name = "bar"
        result = self._wizard_client._dataplex_ops.mark_column_for_regeneration(self._table_fqn, column_name)
        assert result is not None
        
        # Verify column is marked for regeneration
        should_regenerate = self._wizard_client._dataplex_ops.check_if_column_should_be_regenerated(self._table_fqn, column_name)
        assert should_regenerate is True
        
        # Regenerate the table description
        self._wizard_client.generate_table_description(self._table_fqn)
        
        # Mark table as regenerated
        self._wizard_client._dataplex_ops.mark_table_as_regenerated(self._table_fqn)
        
        # Verify table is no longer marked for regeneration
        should_regenerate = self._wizard_client._dataplex_ops.check_if_table_should_be_regenerated(self._table_fqn)
        assert should_regenerate is False
        
        # Regenerate the column descriptions
        self._wizard_client.regenerate_columns_descriptions(self._table_fqn)
        
        # Mark column as regenerated
        self._wizard_client._dataplex_ops.mark_column_as_regenerated(self._table_fqn, column_name)
        
        # Verify column is no longer marked for regeneration
        should_regenerate = self._wizard_client._dataplex_ops.check_if_column_should_be_regenerated(self._table_fqn, column_name)
        assert should_regenerate is False
        
    def test_review_negative_examples(self):
        """Test adding negative examples to review items"""
        # Generate a table description
        self._wizard_client.generate_table_description(self._table_fqn)
        
        # Add a negative example to the table draft description
        negative_example = "This is a bad example that should be avoided"
        result = self._wizard_client._review_ops.add_negative_example_to_table_draft_description(self._table_fqn, negative_example)
        assert result is not None
        
        # Get the negative examples
        negative_examples = self._wizard_client._review_ops.get_negative_examples_to_table_draft_description(self._table_fqn)
        assert len(negative_examples) > 0
        assert negative_example in negative_examples 