#!/usr/bin/env python
# -*- coding: utf-8 -*-

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


# Load constants
constants = toml.loads(pkgutil.get_data(__name__, "constants.toml").decode())
# Logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(constants["LOGGING"]["WIZARD_LOGGER"])


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
        documentation_uri: str,
        client_options: ClientOptions = None
    ):
        if client_options:
            self._client_options = client_options
        else:
            self._client_options = ClientOptions()
        self._project_id = project_id
        self._dataplex_location = dataplex_location
        self.llm_location = llm_location
        self._documentation_uri = documentation_uri

        self._cloud_clients = {
            constants["CLIENTS"]["BIGQUERY"]: bigquery.Client(),
            constants["CLIENTS"][
                "DATAPLEX_DATA_SCAN"
            ]: dataplex_v1.DataScanServiceClient(),
            constants["CLIENTS"][
                "DATA_CATALOG_LINEAGE"
            ]: datacatalog_lineage_v1.LineageClient(),
        }

    def generate_table_description(self, table_fqn: str) -> None:
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
        table_schema_str, table_schema = self._get_table_schema(table_fqn)
        table_sample = self._get_table_sample(
            table_fqn, constants["DATA"]["NUM_ROWS_TO_SAMPLE"]
        )

        table_description_prompt = (
            constants["PROMPTS"]["SYSTEM_PROMPT"]
            + constants["PROMPTS"]["TABLE_DESCRIPTION_PROMPT"]
            + constants["PROMPTS"]["OUTPUT_FORMAT_PROMPT"]
        )
        if self._client_options._use_data_quality:
            table_profile_quality = self._get_table_profile_quality(table_fqn)
            table_quality = table_profile_quality["data_quality"]
        else:
            table_quality = ""
        if self._client_options._use_profile:
            table_profile_quality = self._get_table_profile_quality(table_fqn)
            table_profile = table_profile_quality["data_profile"]
        else:
            table_profile = ""
        if self._client_options._use_lineage_tables:
            table_sources_info = self._get_table_sources_info(table_fqn)
        else:
            table_sources_info = ""
        if self._client_options._use_lineage_processes:
            job_sources_info = self._get_job_sources(table_fqn)
        else:
            job_sources_info = ""

        table_description_prompt_expanded = table_description_prompt.format(
            table_fqn,
            table_schema_str,
            table_sample,
            table_profile,
            table_quality,
            table_sources_info,
            job_sources_info,
        )

        description = self._llm_inference(table_description_prompt_expanded)
        logger.info(f"Generated description: {description}.")
        self._update_table_bq_description(table_fqn, description)

    def generate_columns_descriptions(self, table_fqn: str) -> None:

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

            column_description_prompt = (
                constants["PROMPTS"]["SYSTEM_PROMPT"]
                + constants["PROMPTS"]["COLUMN_DESCRIPTION_PROMPT"]
                + constants["PROMPTS"]["OUTPUT_FORMAT_PROMPT"]
            )
            if self._client_options._use_data_quality:
                table_profile_quality = self._get_table_profile_quality(table_fqn)
                table_quality = table_profile_quality["data_quality"]
            else:
                table_quality = ""
            if self._client_options._use_profile:
                table_profile_quality = self._get_table_profile_quality(table_fqn)
                table_profile = table_profile_quality["data_profile"]
            else:
                table_profile = ""
            if self._client_options._use_lineage_tables:
                table_sources_info = self._get_table_sources_info(table_fqn)
            else:
                table_sources_info = ""
            if self._client_options._use_lineage_processes:
                job_sources_info = self._get_job_sources(table_fqn)
            else:
                job_sources_info = ""

            new_schema = []
            for column in table_schema:
                column_description_prompt_expanded = column_description_prompt.format(
                    column.name,
                    table_fqn,
                    table_schema_str,
                    table_sample,
                    table_profile,
                    table_quality,
                    table_sources_info,
                    job_sources_info,
                )
                column_description = self._llm_inference(column_description_prompt_expanded)

                new_column = bigquery.SchemaField(
                    name=column.name,
                    field_type=column.field_type,
                    mode=column.mode,
                    default_value_expression=column.default_value_expression,
                    description=column_description[0:1024],
                    fields=column.fields,
                    policy_tags=column.policy_tags,
                    precision=column.precision,
                    max_length=column.max_length
                    )
                new_schema.append(new_column)
                logger.info(f"Generated column description: {column_description}.")
            self._update_table_schema(table_fqn, new_schema)
        except Exception as e:
            logger.error(f"Generation of column description table {table_fqn} failed.")
            raise e(message=f"Generation of column description table {table_fqn} failed.")

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
            pattern = r"^([^.]+)\.([^.]+)\.([^.]+)"
            match = re.search(pattern, table_fqn)
            return match.group(1), match.group(2), match.group(3)
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

    def _get_table_profile_quality(self, table_fqn):
        """Add stringdocs

        Args:
            Add stringdocs

        Raises:
            Add stringdocs
        """
        try:
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
                            request=GetDataScanJobRequest(name=job.name, view="FULL")
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
        except Exception as e:
            logger.error(f"Exception: {e}.")
            raise e

    def _get_table_sources_info(self, table_fqn):
        """Add stringdocs

        Args:
            Add stringdocs

        Raises:
            Add stringdocs
        """
        try:
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
            return table_sources_info
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
            request = datacatalog_lineage_v1.SearchLinksRequest(
                parent=f"projects/{self._project_id}/locations/{self._dataplex_location}",
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

    def _get_job_sources(self, table_fqn):
        """Add stringdocs

        Args:
            Add stringdocs

        Raises:
            Add stringdocs
        """
        try:
            lineage_client = datacatalog_lineage_v1.LineageClient()
            bq_process_sql = []
            lineage_client = self._cloud_clients[
                constants["CLIENTS"]["DATA_CATALOG_LINEAGE"]
            ]
            target = datacatalog_lineage_v1.EntityReference()
            target.fully_qualified_name = f"bigquery:{table_fqn}"
            _, dataset_location, _ = self._split_table_fqn(table_fqn)
            request = datacatalog_lineage_v1.SearchLinksRequest(
                parent=f"projects/{self._project_id}/locations/{dataset_location}",
                target=target,
            )
            link_results = lineage_client.search_links(request=request)
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
            return bq_process_sql
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

    def _llm_inference(self, prompt):
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
            if self._client_options._use_ext_documents:
                doc = Part.from_uri(self._documentation_uri, mime_type="application/pdf")
                responses = model.generate_content(
                    [doc, prompt],
                    generation_config=generation_config,
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
