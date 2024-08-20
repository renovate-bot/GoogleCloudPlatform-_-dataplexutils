# pylint: disable=line-too-long
# !/usr/bin/env python
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
"""Dataplex Utils Metadata Wizard main logic
   2024 Google
"""
from .version import __version__

# OS Imports
import logging
import toml
import pkgutil
import re
import json
import pandas
from enum import Enum

# Cloud imports
import vertexai
from google.cloud import bigquery
from google.cloud import dataplex_v1
from google.cloud.dataplex_v1 import (
    GetDataScanRequest,
    ListDataScanJobsRequest,
    GetDataScanJobRequest,
)
from google.cloud import datacatalog_lineage_v1

from google.cloud.dataplex_v1.types.datascans import DataScanJob
from google.cloud.exceptions import NotFound
from vertexai.generative_models import GenerationConfig, GenerativeModel, Part
import vertexai.preview.generative_models as generative_models

import random
from google.cloud import storage

# Load constants
constants = toml.loads(pkgutil.get_data(__name__, "constants.toml").decode())
# Logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(constants["LOGGING"]["WIZARD_LOGGER"])


class PromtType(Enum):
    PROMPT_TYPE_TABLE = 0
    PROMPT_TYPE_COLUMN = 1


class PromptManager:
    """Represents a prompt manager."""

    def __init__(self, prompt_type, client_options):
        self._prompt_type = prompt_type
        self._client_options = client_options

    def get_promtp(self):
        try:
            if self._prompt_type == PromtType.PROMPT_TYPE_TABLE:
                return self._get_prompt_table()
            elif self._prompt_type == PromtType.PROMPT_TYPE_COLUMN:
                return self._get_prompt_columns()
            else:
                return None
        except Exception as e:
            logger.error(f"Exception: {e}.")
            raise e

    def _get_prompt_table(self):
        try:
            # System
            table_description_prompt = constants["PROMPTS"]["SYSTEM_PROMPT"]
            # Base
            table_description_prompt = (
                table_description_prompt
                + constants["PROMPTS"]["TABLE_DESCRIPTION_PROMPT_BASE"]
            )
            # Additional metadata information
            if self._client_options._use_profile:
                table_description_prompt = (
                    table_description_prompt
                    + constants["PROMPTS"]["TABLE_DESCRIPTION_PROMPT_PROFILE"]
                )
            if self._client_options._use_data_quality:
                table_description_prompt = (
                    table_description_prompt
                    + constants["PROMPTS"]["TABLE_DESCRIPTION_PROMPT_QUALITY"]
                )
            if self._client_options._use_lineage_tables:
                table_description_prompt = (
                    table_description_prompt
                    + constants["PROMPTS"]["TABLE_DESCRIPTION_PROMPT_LINEAGE_TABLES"]
                )
            if self._client_options._use_lineage_processes:
                table_description_prompt = (
                    table_description_prompt
                    + constants["PROMPTS"]["TABLE_DESCRIPTION_PROMPT_LINEAGE_PROCESSES"]
                )
            if self._client_options._use_ext_documents:
                table_description_prompt = (
                    table_description_prompt
                    + constants["PROMPTS"]["TABLE_DESCRIPTION_PROMPT_DOCUMENT"]
                )
            # Generation base
            table_description_prompt = (
                table_description_prompt
                + constants["PROMPTS"]["TABLE_DESCRIPTION_GENERATION_BASE"]
            )
            # Generation with additional information
            if (
                self._client_options._use_lineage_tables
                or self._client_options._use_lineage_processes
            ):
                table_description_prompt = (
                    table_description_prompt
                    + constants["PROMPTS"]["TABLE_DESCRIPTION_GENERATION_LINEAGE"]
                )
            # Output format
            table_description_prompt = (
                table_description_prompt + constants["PROMPTS"]["OUTPUT_FORMAT_PROMPT"]
            )
            return table_description_prompt
        except Exception as e:
            logger.error(f"Exception: {e}.")
            raise e

    def _get_prompt_columns(self):
        try:
            # System
            column_description_prompt = constants["PROMPTS"]["SYSTEM_PROMPT"]
            # Base
            column_description_prompt = (
                column_description_prompt
                + constants["PROMPTS"]["COLUMN_DESCRIPTION_PROMPT_BASE"]
            )
            # Additional metadata information
            if self._client_options._use_profile:
                column_description_prompt = (
                    column_description_prompt
                    + constants["PROMPTS"]["TABLE_DESCRIPTION_PROMPT_PROFILE"]
                )
            if self._client_options._use_data_quality:
                column_description_prompt = (
                    column_description_prompt
                    + constants["PROMPTS"]["TABLE_DESCRIPTION_PROMPT_QUALITY"]
                )
            if self._client_options._use_lineage_tables:
                column_description_prompt = (
                    column_description_prompt
                    + constants["PROMPTS"]["TABLE_DESCRIPTION_PROMPT_LINEAGE_TABLES"]
                )
            if self._client_options._use_lineage_processes:
                column_description_prompt = (
                    column_description_prompt
                    + constants["PROMPTS"]["TABLE_DESCRIPTION_PROMPT_LINEAGE_PROCESSES"]
                )
            # Output format
            column_description_prompt = (
                column_description_prompt + constants["PROMPTS"]["OUTPUT_FORMAT_PROMPT"]
            )
            return column_description_prompt
        except Exception as e:
            logger.error(f"Exception: {e}.")
            raise e


class ClientOptions:
    """Represents the client options for the metadata wizard client."""

    def __init__(
        self,
        use_lineage_tables=False,
        use_lineage_processes=False,
        use_profile=False,
        use_data_quality=False,
        use_ext_documents=False,
    ):
        self._use_lineage_tables = use_lineage_tables
        self._use_lineage_processes = use_lineage_processes
        self._use_profile = use_profile
        self._use_data_quality = use_data_quality
        self._use_ext_documents = use_ext_documents


class Client:
    """Represents the main metadata wizard client."""

    def __init__(
        self,
        project_id: str,
        llm_location: str,
        dataplex_location: str,
        # Removed documentatino uri at options level, will provide URI at method generate_table_description level
        #documentation_uri: str,
        client_options: ClientOptions = None,
    ):
        if client_options:
            self._client_options = client_options
        else:
            self._client_options = ClientOptions()
        self._project_id = project_id
        self._dataplex_location = dataplex_location
        self.llm_location = llm_location
        # Removed documentatino uri at options level, will provide URI at method generate_table_description level
        #self._documentation_uri = documentation_uri

        self._cloud_clients = {
            constants["CLIENTS"]["BIGQUERY"]: bigquery.Client(),
            constants["CLIENTS"][
                "DATAPLEX_DATA_SCAN"
            ]: dataplex_v1.DataScanServiceClient(),
            constants["CLIENTS"][
                "DATA_CATALOG_LINEAGE"
            ]: datacatalog_lineage_v1.LineageClient(),
        }

    def generate_dataset_tables_descriptions(self, dataset_fqn,strategy=constants["GENERATION_STRATEGY"]["NAIVE"],documentation_csv_uri=None):
        """Generates metadata on the tables of a whole dataset.

        Args:
            dataset_fqn: The fully qualified name of the dataset
            (e.g., 'project.dataset')

        Returns:
          None.

        Raises:
            NotFound: If the specified table does not exist.
        """
        logger.info(f"Generating metadata for dataset {dataset_fqn}.")
        #for table in list:
       #     self.generate_table_description(f"{dataset_fqn}.{table}")
        try:
            bq_client = self._cloud_clients[constants["CLIENTS"]["BIGQUERY"]]
            bq_client = bigquery.Client()
                        

            int_strategy = int(strategy)
            
            if int_strategy not in constants["GENERATION_STRATEGY"].values():
                raise ValueError(f"Invalid strategy: {strategy}.")
            
            if int_strategy == constants["GENERATION_STRATEGY"]["DOCUMENTED"]:
                if documentation_csv_uri == None:
                    raise ValueError("A documentation URI is required for the DOCUMENTED strategy.")

            tables = self._list_tables_in_dataset(dataset_fqn)
            
            if int_strategy == constants["GENERATION_STRATEGY"]["DOCUMENTED"]:
                tables_from_uri = self._get_tables_from_uri(documentation_csv_uri)
                for table in tables_from_uri:
                    if table[0] not in tables:
                        raise ValueError(f"Table {table} not found in dataset {dataset_fqn}.")
                    self.generate_table_description(table[0], table[1])

            if int_strategy == constants["GENERATION_STRATEGY"]["DOCUMENTED_THEN_REST"]:
                tables_from_uri = self._get_tables_from_uri(documentation_csv_uri)
                for table in tables_from_uri:
                    if table not in tables:
                        raise ValueError(f"Table {table} not found in dataset {dataset_fqn}.")
                    self.generate_table_description(table[0], table[1])
                tables_from_uri_first_elements = [table[0] for table in tables_from_uri]
                for table in tables:
                    if table not in tables_from_uri_first_elements:
                        self.generate_table_description(table)
            
            if int_strategy in [constants["GENERATION_STRATEGY"]["NAIVE"], constants["GENERATION_STRATEGY"]["RANDOM"], constants["GENERATION_STRATEGY"]["ALPHABETICAL"]]:
                tables_sorted = self._order_tables_to_strategy(tables, int_strategy)
                for table in tables_sorted:
                    self.generate_table_description(table)
               # self.generate_column_descriptions(table)

        except Exception as e:
            logger.error(f"Exception: {e}.")
            raise e







    def generate_table_description(self, table_fqn, documentation_uri=None):
        """Generates metadata on the tabes.

        Args:
            table_fqn: The fully qualified name of the table
            (e.g., 'project.dataset.table')

        Returns:
          None.

        Raises:
            NotFound: If the specified table does not exist.
        """
        logger.info(f"Generating metadata for table {table_fqn}.")
        
        
        self._table_exists(table_fqn)
        # Get base information
        logger.info(f"Getting schema for table {table_fqn}.")
        table_schema_str, _ = self._`get_table_`schema(table_fqn)
        logger.info(f"Getting sample for table {table_fqn}.")
        table_sample = self._get_table_sample(
            table_fqn, constants["DATA"]["NUM_ROWS_TO_SAMPLE"]
        )
        # Get additional information
        logger.info(f"Getting table quality for table {table_fqn}.")
        table_quality = self._get_table_quality(
            self._client_options._use_data_quality, table_fqn
        )
        logger.info(f"Getting table profile for table {table_fqn}.")
        table_profile = self._get_table_profile(
            self._client_options._use_profile, table_fqn
        )
        logger.info(f"Getting source tables for table {table_fqn}.")
        table_sources_info = self._get_table_sources_info(
            self._client_options._use_lineage_tables, table_fqn
        )
        logger.info(f"Getting jobs calculating for table {table_fqn}.")
        job_sources_info = self._get_job_sources(
            self._client_options._use_lineage_processes, table_fqn
        )
        prompt_manager = PromptManager(
            PromtType.PROMPT_TYPE_TABLE, self._client_options
        )

        if documentation_uri == "":
            documentation_uri = None


        # Get prompt
        table_description_prompt = prompt_manager.get_promtp()
        # Format prompt
        table_description_prompt_expanded = table_description_prompt.format(
            table_fqn=table_fqn,
            table_schema_str=table_schema_str,
            table_sample=table_sample,
            table_profile=table_profile,
            table_quality=table_quality,
            table_sources_info=table_sources_info,
            job_sources_info=job_sources_info,
        )
        #logger.info(f"Prompt used is: {table_description_prompt_expanded}.")
        table_description = self._llm_inference(table_description_prompt_expanded,documentation_uri)
        #logger.info(f"Generated description: {table_description}.")
        # Update table
        self._update_table_bq_description(table_fqn, table_description)

    def generate_columns_descriptions(self, table_fqn,documentation_uri=None):
        """Generates metadata on the columns.

        Args:
            table_fqn: The fully qualified name of the table
            (e.g., 'project.dataset.table')

        Returns:
          None.

        Raises:
            NotFound: If the specified table does not exist.
        """
        try:
            logger.info(f"Generating metadata for columns in table {table_fqn}.")
            self._table_exists(table_fqn)
            table_schema_str, table_schema = self._get_table_schema(table_fqn)
            table_sample = self._get_table_sample(
                table_fqn, constants["DATA"]["NUM_ROWS_TO_SAMPLE"]
            )

            # Get additional information
            table_quality = self._get_table_quality(
                self._client_options._use_data_quality, table_fqn
            )
            table_profile = self._get_table_profile(
                self._client_options._use_profile, table_fqn
            )
            table_sources_info = self._get_table_sources_info(
                self._client_options._use_lineage_tables, table_fqn
            )
            job_sources_info = self._get_job_sources(
                self._client_options._use_lineage_processes, table_fqn
            )

            if documentation_uri == "":
                documentation_uri = None

            prompt_manager = PromptManager(
                PromtType.PROMPT_TYPE_TABLE, self._client_options
            )
            # Get prompt
            prompt_manager = PromptManager(
                PromtType.PROMPT_TYPE_COLUMN, self._client_options
            )
            column_description_prompt = prompt_manager.get_promtp()
            # We need to generate a new schema with the updated column
            # descriptions and then swap it
            updated_schema = []
            for column in table_schema:
                column_description_prompt_expanded = column_description_prompt.format(
                    column_name=column.name,
                    table_fqn=table_fqn,
                    table_schema_str=table_schema_str,
                    table_sample=table_sample,
                    table_profile=table_profile,
                    table_quality=table_quality,
                    table_sources_info=table_sources_info,
                    job_sources_info=job_sources_info,
                )
                #logger.info(f"Prompt used is: {column_description_prompt_expanded}.")
                column_description = self._llm_inference(
                    column_description_prompt_expanded,
                    documentation_uri=documentation_uri,
                )
                updated_schema.append(
                    self._get_updated_column(column, column_description)
                )
                logger.info(f"Generated column description: {column_description}.")
            self._update_table_schema(table_fqn, updated_schema)
        except Exception as e:
            logger.error(f"Generation of column description table {table_fqn} failed.")
            raise e(
                message=f"Generation of column description table {table_fqn} failed."
            )

    def _get_tables_from_uri(self, documentation_csv_uri):
        """Reads the CSV file from Google Cloud Storage and returns the tables.

        Args:
            documentation_csv_uri: The URI of the CSV file in Google Cloud Storage.

        Returns:
            A list of tables.

        Raises:
            Exception: If there is an error reading the CSV file.
        """
        try:
            # Create a client to interact with Google Cloud Storage
            storage_client = storage.Client()

            # Get the bucket and blob names from the URI
            bucket_name, blob_name = documentation_csv_uri.split("/", 3)[2:]

            # Get the bucket and blob objects
            bucket = storage_client.get_bucket(bucket_name)
            blob = bucket.blob(blob_name)

            # Download the CSV file as a string
            csv_data = blob.download_as_text()

            # Split the CSV data into lines
            lines = csv_data.split("\n")

            # Remove any empty lines
            lines = [line for line in lines if line.strip()]

            # Extract the table names from the lines
            tables = [(line.split(",")[0], line.split(",")[1]) for line in lines]

            return tables
        except Exception as e:
            logger.error(f"Exception: {e}.")
            raise e

    def _order_tables_to_strategy(self, tables, strategy):
        
        if strategy == constants["GENERATION_STRATEGY"]["NAIVE"]:
            return tables
        elif strategy == constants["GENERATION_STRATEGY"]["RANDOM"]:
            tables_copy=tables.copy()
            random.shuffle(tables_copy)
            return tables_copy
        elif strategy == constants["GENERATION_STRATEGY"]["ALPHABETICAL"]:
            return sorted(tables)
        else:
            return tables

    def _list_tables_in_dataset(self,dataset_fqn):
        """Lists all tables in a given dataset.

        Args:
            project_id: The ID of the project.
            dataset_id: The ID of the dataset.

        Returns:
            A list of table names.
        """

        client = self._cloud_clients[
                    constants["CLIENTS"]["BIGQUERY"]
                ]
        client = bigquery.Client()

        project_id, dataset_id = self._split_dataset_fqn(dataset_fqn)

        dataset_ref = client.dataset(dataset_id, project=project_id)
        tables = client.list_tables(dataset_ref)

        table_names = [str(table.full_table_id).replace(":",".") for table in tables]
        return table_names


    def _get_updated_column(self, column, column_description):
        try:
            return bigquery.SchemaField(
                name=column.name,
                field_type=column.field_type,
                mode=column.mode,
                default_value_expression=column.default_value_expression,
                description=column_description[
                    0 : constants["DATA"]["MAX_COLUMN_DESC_LENGTH"]
                ],
                fields=column.fields,
                policy_tags=column.policy_tags,
                precision=column.precision,
                max_length=column.max_length,
            )
        except Exception as e:
            logger.error(f"Exception: {e}.")
            raise e

    def _table_exists(self, table_fqn: str) -> None:
        """Checks if a specified BigQuery table exists.

        Args:
            table_fqn: The fully qualified name of the table
            (e.g., 'project.dataset.table')

        Raises:
            NotFound: If the specified table does not exist.
        """
        try:
            self._cloud_clients[constants["CLIENTS"]["BIGQUERY"]].get_table(table_fqn)
        except NotFound:
            logger.error(f"Table {table_fqn} is not found.")
            raise NotFound(message=f"Table {table_fqn} is not found.")

    def _get_table_schema(self, table_fqn):
        """Add stringdocs

        Args:
            Add stringdocs

        Raises:
            Add stringdocs
        """
        try:
            table = self._cloud_clients[constants["CLIENTS"]["BIGQUERY"]].get_table(
                table_fqn
            )
            schema_fields = table.schema
            flattened_schema = [
                {"name": field.name, "type": field.field_type}
                for field in schema_fields
            ]
            return flattened_schema, table.schema
        except NotFound:
            logger.error(f"Table {table_fqn} is not found.")
            raise NotFound(message=f"Table {table_fqn} is not found.")

    def _get_table_sample(self, table_fqn, num_rows_to_sample):
        """Add stringdocs

        Args:
            Add stringdocs

        Raises:
            Add stringdocs
        """
        try:
            bq_client = self._cloud_clients[constants["CLIENTS"]["BIGQUERY"]]
            query = f"SELECT * FROM {table_fqn} LIMIT {num_rows_to_sample}"
            return bq_client.query(query).to_dataframe().to_json()
        except bigquery.exceptions.BadRequest as e:
            print(f"BigQuery Bad Request: {e}")
            return "[]"
        except Exception as e:
            logger.error(f"Exception: {e}.")
            raise e

    def _split_table_fqn(self, table_fqn):
        """Add stringdocs

        Args:
            Add stringdocs

        Raises:
            Add stringdocs
        """
        try:
            pattern = r"^([^.]+)[\.:]([^.]+)\.([^.]+)"
            logger.debug(f"Splitting table FQN: {table_fqn}.")
            match = re.search(pattern, table_fqn)
            logger.debug(f"I hope i Found 3 groups: {match.group(1)} {match.group(2)} {match.group(3)}")
            return match.group(1), match.group(2), match.group(3)
        except Exception as e:
            logger.error(f"Exception: {e}.")
            raise e
        
    def _split_dataset_fqn(self, dataset_fqn):
        """Add stringdocs

        Args:
            Add stringdocs

        Raises:
            Add stringdocs
        """
        try:
            pattern = r"^([^.]+)\.([^.]+)"
            match = re.search(pattern, dataset_fqn)
            return match.group(1), match.group(2)
        except Exception as e:
            logger.error(f"Exception: {e}.")
            raise e

    def _construct_bq_resource_string(self, table_fqn):
        """Add stringdocs

        Args:
            Add stringdocs

        Raises:
            Add stringdocs
        """
        try:
            project_id, dataset_id, table_id = self._split_table_fqn(table_fqn)
            return f"//bigquery.googleapis.com/projects/{project_id}/datasets/{dataset_id}/tables/{table_id}"
        except Exception as e:
            logger.error(f"Exception: {e}.")
            raise e

    def _get_table_scan_reference(self, table_fqn):
        """Add stringdocs

        Args:
            Add stringdocs

        Raises:
            Add stringdocs
        """
        try:
            scan_references = None
            scan_client = self._cloud_clients[
                constants["CLIENTS"]["DATAPLEX_DATA_SCAN"]
            ]
            logger.info(f"Getting table scan reference for table:{table_fqn}.")
            data_scans = scan_client.list_data_scans(
                parent=f"projects/{self._project_id}/locations/{self._dataplex_location}"
            )
            bq_resource_string = self._construct_bq_resource_string(table_fqn)
            scan_references = []
            for scan in data_scans:
                if scan.data.resource == bq_resource_string:
                    scan_references.append(scan.name)
            return scan_references
        except Exception as e:
            logger.error(f"Exception: {e}.")
            raise e

    def _get_table_profile(self, use_enabled, table_fqn):
        try:
            table_profile = self._get_table_profile_quality(use_enabled, table_fqn)["data_profile"]
            if not table_profile:
                self._client_options._use_profile = False
            return table_profile
        except Exception as e:
            logger.error(f"Exception: {e}.")
            raise e

    def _get_table_quality(self, use_enabled, table_fqn):
        try:
            table_quality = self._get_table_profile_quality(use_enabled, table_fqn)["data_quality"]
            # If the user is requesting to use data quality but there is
            # not data quality information to return, we disable the client
            # options flag so the prompt do not include this.
            if not table_quality:
                self._client_options._use_data_quality = False
            return table_quality
        except Exception as e:
            logger.error(f"Exception: {e}.")
            raise e

    def _get_table_profile_quality(self, use_enabled, table_fqn):
        """Add stringdocs

        Args:
            Add stringdocs

        Raises:
            Add stringdocs
        """
        try:
            if use_enabled:
                scan_client = self._cloud_clients[
                    constants["CLIENTS"]["DATAPLEX_DATA_SCAN"]
                ]
                data_profile_results = []
                data_quality_results = []
                table_scan_references = self._get_table_scan_reference(table_fqn)
                for table_scan_reference in table_scan_references:
                    if table_scan_reference:
                        for job in scan_client.list_data_scan_jobs(
                            ListDataScanJobsRequest(
                                parent=scan_client.get_data_scan(
                                    GetDataScanRequest(name=table_scan_reference)
                                ).name
                            )
                        ):
                            job_result = scan_client.get_data_scan_job(
                                request=GetDataScanJobRequest(
                                    name=job.name, view="FULL"
                                )
                            )
                            if job_result.state == DataScanJob.State.SUCCEEDED:
                                job_result_json = json.loads(
                                    dataplex_v1.types.datascans.DataScanJob.to_json(
                                        job_result
                                    )
                                )
                                if "dataQualityResult" in job_result_json:
                                    data_quality_results.append(
                                        job_result_json["dataQualityResult"]
                                    )
                                if "dataProfileResult" in job_result_json:
                                    data_profile_results.append(
                                        job_result_json["dataProfileResult"]
                                    )
                return {
                    "data_profile": data_profile_results,
                    "data_quality": data_quality_results,
                }
            else:
                return {
                    "data_profile": [],
                    "data_quality": [],
                }
        except Exception as e:
            logger.error(f"Exception: {e}.")
            raise e

    def _get_table_sources_info(self, use_enabled, table_fqn):
        """Add stringdocs

        Args:
            Add stringdocs

        Raises:
            Add stringdocs
        """
        try:
            if use_enabled:
                table_sources_info = []
                table_sources = self._get_table_sources(table_fqn)
                for table_source in table_sources:
                    table_sources_info.append(
                        {
                            "source_table_name": table_source,
                            "source_table_schema": self._get_table_schema(table_source),
                            "source_table_description": self._get_table_description(
                                table_source
                            ),
                            "source_table_sample": self._get_table_sample(
                                table_source, constants["DATA"]["NUM_ROWS_TO_SAMPLE"]
                            ),
                        }
                    )
                if not table_sources_info:
                    self._client_options._use_lineage_tables = False
                return table_sources_info
            else:
                return []
        except Exception as e:
            logger.error(f"Exception: {e}.")
            raise e

    def _get_table_sources(self, table_fqn):
        """Add stringdocs

        Args:
            Add stringdocs

        Raises:
            Add stringdocs
        """
        try:
            lineage_client = self._cloud_clients[
                constants["CLIENTS"]["DATA_CATALOG_LINEAGE"]
            ]
            target = datacatalog_lineage_v1.EntityReference()
            target.fully_qualified_name = f"bigquery:{table_fqn}"
            target_dataset=str(self._get_dataset_location(table_fqn)).lower()
            logger.info(f"_get_table_sources:Searching for lineage links for table {table_fqn}. in dataset {target_dataset}")
            request = datacatalog_lineage_v1.SearchLinksRequest(
                parent=f"projects/{self._project_id}/locations/{target_dataset}",
                target=target,
            )
            link_results = lineage_client.search_links(request=request)
            table_sources = []
            for link in link_results:
                if link.target == target:
                    table_sources.append(
                        link.source.fully_qualified_name.replace("bigquery:", "")
                    )
            return table_sources
        except Exception as e:
            logger.error(f"Exception: {e}.")
            raise e

    def _get_dataset_location(self, table_fqn):
        try:
            bq_client = self._cloud_clients[constants["CLIENTS"]["BIGQUERY"]]
            project_id, dataset_id, _ = self._split_table_fqn(table_fqn)
            return str(bq_client.get_dataset(f"{project_id}.{dataset_id}").location).lower()
        except Exception as e:
            logger.error(f"Exception: {e}.")
            raise e

    def _get_job_sources(self, use_enabled, table_fqn):
        """Add stringdocs

        Args:
            Add stringdocs

        Raises:
            Add stringdocs
        """
        try:
            if use_enabled:
                bq_process_sql = []
                lineage_client = self._cloud_clients[
                    constants["CLIENTS"]["DATA_CATALOG_LINEAGE"]
                ]
                target = datacatalog_lineage_v1.EntityReference()
                target.fully_qualified_name = f"bigquery:{table_fqn}"
                dataset_location = self._get_dataset_location(table_fqn)
                logger.info(f"Searching for lineage links for table {table_fqn}.")
                request = datacatalog_lineage_v1.SearchLinksRequest(
                    parent=f"projects/{self._project_id}/locations/{dataset_location}",
                    target=target,
                )
                try:
                    link_results = lineage_client.search_links(request=request)
                except Exception as e:
                    logger.error(f"Cannot find lineage links for table {table_fqn}:exception:{e}.")
                    return []
                    raise e
                
                if len(link_results.links) > 0:
                    links = [link.name for link in link_results]
                    lineage_processes_ids = [
                        process.process
                        for process in lineage_client.batch_search_link_processes(
                            request=datacatalog_lineage_v1.BatchSearchLinkProcessesRequest(
                                parent=f"projects/{self._project_id}/locations/{dataset_location}",
                                links=links,
                            )
                        )
                    ]
                    for process_id in lineage_processes_ids:
                        process_details = lineage_client.get_process(
                            request=datacatalog_lineage_v1.GetProcessRequest(
                                name=process_id,
                            )
                        )
                        if "bigquery_job_id" in process_details.attributes:
                            bq_process_sql.append(
                                self._bq_job_info(
                                    process_details.attributes["bigquery_job_id"],
                                    dataset_location,
                                )
                            )
                    if not bq_process_sql:
                        self._client_options._use_lineage_processes = False
                    return bq_process_sql
                else:
                    self._client_options._use_lineage_processes = False
                    return []
            else:
                return []
        except Exception as e:
            logger.error(f"Exception: {e}.")
            raise e

    def _bq_job_info(self, bq_job_id, dataset_location):
        """Add stringdocs

        Args:
            Add stringdocs

        Raises:
            Add stringdocs
        """
        try:
            return (
                self._cloud_clients[constants["CLIENTS"]["BIGQUERY"]]
                .get_job(bq_job_id, location=dataset_location)
                .query
            )
        except Exception as e:
            logger.error(f"Exception: {e}.")
            raise e

    def _llm_inference(self, prompt, documentation_uri=None):
        try:
            vertexai.init(project=self._project_id, location=self.llm_location)
            if self._client_options._use_ext_documents:
                model = GenerativeModel(constants["LLM"]["LLM_VISION_TYPE"])
            else:
                model = GenerativeModel(constants["LLM"]["LLM_TYPE"])

            generation_config = GenerationConfig(
                temperature=constants["LLM"]["TEMPERATURE"],
                top_p=constants["LLM"]["TOP_P"],
                top_k=constants["LLM"]["TOP_K"],
                candidate_count=constants["LLM"]["CANDIDATE_COUNT"],
                max_output_tokens=constants["LLM"]["MAX_OUTPUT_TOKENS"],
            )
            safety_settings = {
                generative_models.HarmCategory.HARM_CATEGORY_HATE_SPEECH: generative_models.HarmBlockThreshold.BLOCK_ONLY_HIGH,
                generative_models.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: generative_models.HarmBlockThreshold.BLOCK_ONLY_HIGH,
                generative_models.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: generative_models.HarmBlockThreshold.BLOCK_ONLY_HIGH,
                generative_models.HarmCategory.HARM_CATEGORY_HARASSMENT: generative_models.HarmBlockThreshold.BLOCK_ONLY_HIGH,
            }
            if documentation_uri != None:
                doc = Part.from_uri(
                    documentation_uri, mime_type=constants["DATA"]["PDF_MIME_TYPE"]
                )
                responses = model.generate_content(
                    [doc, prompt],
                    generation_config=generation_config,
                    safety_settings=safety_settings,
                    stream=False,
                )
            else:
                responses = model.generate_content(
                    prompt,
                    generation_config=generation_config,
                    stream=False,
                )
            return responses.text
        except Exception as e:
            logger.error(f"Exception: {e}.")
            raise e

    def _get_table_description(self, table_fqn):
        """Add stringdocs

        Args:
            Add stringdocs

        Raises:
            Add stringdocs
        """
        try:
            table = self._cloud_clients[constants["CLIENTS"]["BIGQUERY"]].get_table(
                table_fqn
            )
            return table.description
        except Exception as e:
            logger.error(f"Exception: {e}.")
            raise e

    def _update_table_bq_description(self, table_fqn, description):
        """Add stringdocs

        Args:
            Add stringdocs

        Raises:
            Add stringdocs
        """
        try:
            table = self._cloud_clients[constants["CLIENTS"]["BIGQUERY"]].get_table(
                table_fqn
            )
            table.description = description
            _ = self._cloud_clients[constants["CLIENTS"]["BIGQUERY"]].update_table(
                table, ["description"]
            )
        except Exception as e:
            logger.error(f"Exception: {e}.")
            raise e

    def _update_table_schema(self, table_fqn, schema):
        """Add stringdocs

        Args:
            Add stringdocs

        Raises:
            Add stringdocs
        """
        try:
            table = self._cloud_clients[constants["CLIENTS"]["BIGQUERY"]].get_table(
                table_fqn
            )
            table.schema = schema
            _ = self._cloud_clients[constants["CLIENTS"]["BIGQUERY"]].update_table(
                table, ["schema"]
            )
        except Exception as e:
            logger.error(f"Exception: {e}.")
            raise e
