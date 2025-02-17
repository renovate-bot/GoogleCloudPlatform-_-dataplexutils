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
"""Dataplex Utils Metadata Wizard review operations
   2024 Google
"""
# Standard library imports
import logging
import toml
import pkgutil
import datetime
import uuid
import traceback

# Cloud imports
from google.cloud import dataplex_v1
from google.protobuf import field_mask_pb2, struct_pb2
import google.api_core.exceptions

# Load constants
constants = toml.loads(pkgutil.get_data(__name__, "constants.toml").decode())
# Logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(constants["LOGGING"]["WIZARD_LOGGER"])

class ReviewOperations:
    """Review-specific operations."""

    def __init__(self, client):
        """Initialize with reference to main client."""
        self._client = client

    def get_review_items_for_dataset(self, search_query: str = "cc", page_size: int = 100, page_token: str = None) -> dict:
        """Get review items for a dataset based on search criteria.

        Args:
            search_query (str): Optional search query to filter tables
            page_size (int): Number of items per page
            page_token (str): Token for pagination

        Returns:
            dict: Dictionary containing review items and pagination info
        """
        try:
            logger.info(f"Processing search query: {search_query}")
            
            review_items = []
            result_count = 0
            
            try:
                client = self._client._cloud_clients[constants["CLIENTS"]["DATAPLEX_CATALOG"]]
                name = f"projects/{self._client._project_id}/locations/global"
                query = f"""system=BIGQUERY"""
                if search_query:
                    query = f"""{query} AND ({search_query})"""
                logger.info(f"Built search request - name: {name}, query: {query}")
                
                request = dataplex_v1.SearchEntriesRequest(
                    name=name,
                    query=query,
                    page_size=page_size,
                    page_token=page_token
                )
        
                response = client.search_entries(request=request)
                logger.info("Got search response")
                
                for result in response:
                    if not hasattr(result, 'dataplex_entry'):
                        logger.info("Result has no dataplex_entry, skipping")
                        continue
                        
                    entry = result.dataplex_entry
                    if not entry.fully_qualified_name.startswith("bigquery:"):
                        logger.info(f"Entry {entry.fully_qualified_name} is not a BigQuery table, skipping")
                        continue
                        
                    table_fqn = entry.fully_qualified_name.replace("bigquery:", "")
                    current_description = ""
                    
                    if hasattr(entry, 'entry_source') and hasattr(entry.entry_source, 'description'):
                        current_description = entry.entry_source.description
                        logger.info(f"Found description for {table_fqn}: {current_description}")
                    
                    review_item = {
                        "id": f"{table_fqn}#table",
                        "type": "table",
                        "name": table_fqn,
                        "currentDescription": current_description,
                        "draftDescription": "",  # Empty for list view
                        "isHtml": False,
                        "status": "current",
                        "lastModified": entry.update_time.isoformat() if hasattr(entry, 'update_time') else datetime.datetime.now().isoformat(),
                        "comments": [],  # Empty for list view
                        "markedForRegeneration": False  # Default for list view
                    }
                    review_items.append(review_item)
                    result_count += 1
                    logger.info(f"Added review item for table {table_fqn}")
                
                response_data = {
                    "items": review_items,
                    "nextPageToken": response.next_page_token if hasattr(response, 'next_page_token') else None,
                    "totalCount": response.total_size if hasattr(response, 'total_size') else result_count
                }
                
                return {"data": response_data}
                
            except Exception as e:
                logger.error(f"Error during search_entries call: {str(e)}")
                raise
            
        except Exception as e:
            logger.error(f"Error getting review items for search query '{search_query}': {str(e)}")
            raise

    def get_review_item_details(self, table_fqn: str, column_name: str = None) -> dict:
        """Get detailed information about a specific review item.

        Args:
            table_fqn (str): The fully qualified name of the table
            column_name (str, optional): The name of the column

        Returns:
            dict: Detailed information about the review item
        """
        try:
            if column_name:
                # Handle column details
                flat_schema, schema = self._client._bigquery_ops.get_table_schema(table_fqn)
                if not schema:
                    raise ValueError(f"Table {table_fqn} not found")

                column = next((f for f in schema if f.name == column_name), None)
                if not column:
                    raise ValueError(f"Column {column_name} not found in table {table_fqn}")

                current_description = column.description
                draft_description = self._get_column_draft_description(table_fqn, column_name)
                
                raw_comments = self._client._dataplex_ops.get_column_comment(table_fqn, column_name) or []
                comments = []
                for comment in raw_comments:
                    if isinstance(comment, str):
                        comments.append(comment)

                return {
                    "type": "column",
                    "id": f"{table_fqn}#column#{column_name}",
                    "name": f"{table_fqn}.{column_name}",
                    "currentDescription": current_description or "",
                    "draftDescription": draft_description or "",
                    "isHtml": False,
                    "status": "draft" if draft_description else "current",
                    "lastModified": datetime.datetime.now().isoformat(),
                    "comments": comments,
                    "markedForRegeneration": self._client._dataplex_ops.check_if_column_should_be_regenerated(table_fqn, column_name)
                }
            else:
                # Handle table details
                flat_schema, schema = self._client._bigquery_ops.get_table_schema(table_fqn)
                if not schema:
                    raise ValueError(f"Table {table_fqn} not found")

                current_description = self._client._bigquery_ops.get_table_description(table_fqn)
                draft_description = self._get_table_draft_description(table_fqn)

                comments = self.get_comments_to_table_draft_description(table_fqn) or []
                negative_examples = self.get_negative_examples_to_table_draft_description(table_fqn) or []
                
                all_comments = []
                for comment in comments:
                    if isinstance(comment, str):
                        all_comments.append(comment)
                for example in negative_examples:
                    if isinstance(example, str):
                        all_comments.append(example)

                return {
                    "type": "table",
                    "id": f"{table_fqn}#table",
                    "name": table_fqn,
                    "currentDescription": current_description or "",
                    "draftDescription": draft_description or "",
                    "isHtml": False,
                    "status": "draft" if draft_description else "current",
                    "lastModified": datetime.datetime.now().isoformat(),
                    "comments": all_comments,
                    "markedForRegeneration": self._client._dataplex_ops.check_if_table_should_be_regenerated(table_fqn)
                }

        except Exception as e:
            logger.error(f"Error getting review item details for table {table_fqn} column {column_name}: {str(e)}")
            raise

    def get_comments_to_table_draft_description(self, table_fqn):
        """Get all comments for a table's draft description.

        Args:
            table_fqn (str): The fully qualified name of the table

        Returns:
            list: List of comments associated with the draft description
        """
        try:
            logger.info(f"=== START: get_comments_to_table_draft_description for {table_fqn} ===")
            
            client = self._client._cloud_clients[constants["CLIENTS"]["DATAPLEX_CATALOG"]]
            project_id, dataset_id, table_id = self._client._utils.split_table_fqn(table_fqn)
            
            aspect_type = f"""projects/{self._client._project_id}/locations/global/aspectTypes/{constants["ASPECT_TEMPLATE"]["name"]}"""
            aspect_types = [aspect_type]
            entry_name = f"projects/{project_id}/locations/{self._client._dataplex_ops._get_dataset_location(table_fqn)}/entryGroups/@bigquery/entries/bigquery.googleapis.com/projects/{project_id}/datasets/{dataset_id}/tables/{table_id}"

            request = dataplex_v1.GetEntryRequest(
                name=entry_name,
                view=dataplex_v1.EntryView.CUSTOM,
                aspect_types=aspect_types
            )
            entry = client.get_entry(request=request)

            for aspect_key, aspect in entry.aspects.items():
                if aspect_key.endswith(f"""global.{constants["ASPECT_TEMPLATE"]["name"]}""") and aspect.path == "":
                    if "human-comments" in aspect.data:
                        raw_comments = aspect.data["human-comments"]
                        validated_comments = []
                        for comment in raw_comments:
                            if isinstance(comment, str):
                                validated_comments.append(comment)
                        return validated_comments

            return []

        except Exception as e:
            logger.error(f"Error getting comments for table {table_fqn}: {str(e)}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            return []

    def get_negative_examples_to_table_draft_description(self, table_fqn):
        """Get all negative examples for a table's draft description.

        Args:
            table_fqn (str): The fully qualified name of the table

        Returns:
            list: List of negative examples associated with the draft description
        """
        try:
            client = self._client._cloud_clients[constants["CLIENTS"]["DATAPLEX_CATALOG"]]
            project_id, dataset_id, table_id = self._client._utils.split_table_fqn(table_fqn)
            
            aspect_type = f"""projects/{self._client._project_id}/locations/global/aspectTypes/{constants["ASPECT_TEMPLATE"]["name"]}"""
            aspect_types = [aspect_type]
            entry_name = f"projects/{project_id}/locations/{self._client._dataplex_ops._get_dataset_location(table_fqn)}/entryGroups/@bigquery/entries/bigquery.googleapis.com/projects/{project_id}/datasets/{dataset_id}/tables/{table_id}"

            request = dataplex_v1.GetEntryRequest(
                name=entry_name,
                view=dataplex_v1.EntryView.CUSTOM,
                aspect_types=aspect_types
            )
            entry = client.get_entry(request=request)

            for aspect_key, aspect in entry.aspects.items():
                if aspect_key.endswith(f"""global.{constants["ASPECT_TEMPLATE"]["name"]}""") and aspect.path == "":
                    if "negative-examples" in aspect.data:
                        return aspect.data["negative-examples"]
            
            return []

        except Exception as e:
            logger.error(f"Error getting negative examples for table {table_fqn}: {str(e)}")
            return []

    def add_comment_to_table_draft_description(self, table_fqn, comment):
        """Add a comment to a table's draft description.

        Args:
            table_fqn (str): The fully qualified name of the table
            comment (str): The comment to add

        Returns:
            bool: True if successful
        """
        try:
            client = self._client._cloud_clients[constants["CLIENTS"]["DATAPLEX_CATALOG"]]
            project_id, dataset_id, table_id = self._client._utils.split_table_fqn(table_fqn)
            
            aspect_type = f"""projects/{self._client._project_id}/locations/global/aspectTypes/{constants["ASPECT_TEMPLATE"]["name"]}"""
            aspect_name = f"""{self._client._project_id}.global.{constants["ASPECT_TEMPLATE"]["name"]}"""
            entry_name = f"projects/{project_id}/locations/{self._client._dataplex_ops._get_dataset_location(table_fqn)}/entryGroups/@bigquery/entries/bigquery.googleapis.com/projects/{project_id}/datasets/{dataset_id}/tables/{table_id}"
            
            new_aspect = dataplex_v1.Aspect()
            new_aspect.aspect_type = aspect_type
            
            try:
                request = dataplex_v1.GetEntryRequest(
                    name=entry_name,
                    view=dataplex_v1.EntryView.CUSTOM,
                    aspect_types=[aspect_type]
                )
                entry = client.get_entry(request=request)
                
                aspect_found = False
                for i in entry.aspects:
                    if i.endswith(f"""global.{constants["ASPECT_TEMPLATE"]["name"]}""") and entry.aspects[i].path == "":
                        aspect_found = True
                        new_aspect.data = entry.aspects[i].data
                        existing_comments = list(new_aspect.data.get("human-comments", []))
                        existing_comments.append(comment)
                        new_aspect.data["human-comments"] = existing_comments
                        break
                
                if not aspect_found:
                    aspect_data = {
                        "human-comments": [comment]
                    }
                    data_struct = struct_pb2.Struct()
                    data_struct.update(aspect_data)
                    new_aspect.data = data_struct
                
            except google.api_core.exceptions.NotFound:
                aspect_data = {
                    "human-comments": [comment]
                }
                data_struct = struct_pb2.Struct()
                data_struct.update(aspect_data)
                new_aspect.data = data_struct
            
            new_entry = dataplex_v1.Entry()
            new_entry.name = entry_name
            new_entry.aspects[aspect_name] = new_aspect
            
            request = dataplex_v1.UpdateEntryRequest(
                entry=new_entry,
                update_mask=field_mask_pb2.FieldMask(paths=["aspects"]),
                allow_missing=False,
                aspect_keys=[aspect_name]
            )
            
            response = client.update_entry(request=request)
            return True
            
        except Exception as e:
            logger.error(f"Error updating comments: {str(e)}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            return False

    def add_comment_to_column_draft_description(self, table_fqn, column_name, comment):
        """Add a comment to a column's draft description.

        Args:
            table_fqn (str): The fully qualified name of the table
            column_name (str): The name of the column
            comment (str): The comment to add

        Returns:
            bool: True if successful
        """
        try:
            logger.info(f"=== START: add_comment_to_column_draft_description for {table_fqn}.{column_name} ===")
            
            client = self._client._cloud_clients[constants["CLIENTS"]["DATAPLEX_CATALOG"]]
            project_id, dataset_id, table_id = self._client._utils.split_table_fqn(table_fqn)
            
            aspect_type = f"""projects/{self._client._project_id}/locations/global/aspectTypes/{constants["ASPECT_TEMPLATE"]["name"]}"""
            aspect_name = f"""{self._client._project_id}.global.{constants["ASPECT_TEMPLATE"]["name"]}@Schema.{column_name}"""
            entry_name = f"projects/{project_id}/locations/{self._client._dataplex_ops._get_dataset_location(table_fqn)}/entryGroups/@bigquery/entries/bigquery.googleapis.com/projects/{project_id}/datasets/{dataset_id}/tables/{table_id}"

            new_aspect = dataplex_v1.Aspect()
            new_aspect.aspect_type = aspect_type
            new_aspect.path = f"Schema.{column_name}"

            try:
                request = dataplex_v1.GetEntryRequest(
                    name=entry_name,
                    view=dataplex_v1.EntryView.CUSTOM,
                    aspect_types=[aspect_type]
                )
                entry = client.get_entry(request=request)
                
                found_aspect = False
                for i in entry.aspects:
                    if i.endswith(f"""global.{constants["ASPECT_TEMPLATE"]["name"]}@Schema.{column_name}""") and entry.aspects[i].path == f"Schema.{column_name}":
                        found_aspect = True
                        new_aspect.data = entry.aspects[i].data
                        existing_comments = list(new_aspect.data.get("human-comments", []))
                        existing_comments.append(comment)
                        new_aspect.data["human-comments"] = existing_comments
                        break
                
                if not found_aspect:
                    aspect_data = {
                        "human-comments": [comment]
                    }
                    data_struct = struct_pb2.Struct()
                    data_struct.update(aspect_data)
                    new_aspect.data = data_struct

            except google.api_core.exceptions.NotFound:
                aspect_data = {
                    "human-comments": [comment]
                }
                data_struct = struct_pb2.Struct()
                data_struct.update(aspect_data)
                new_aspect.data = data_struct

            new_entry = dataplex_v1.Entry()
            new_entry.name = entry_name
            new_entry.aspects[aspect_name] = new_aspect

            request = dataplex_v1.UpdateEntryRequest(
                entry=new_entry,
                update_mask=field_mask_pb2.FieldMask(paths=["aspects"]),
                allow_missing=False,
                aspect_keys=[aspect_name]
            )
            
            response = client.update_entry(request=request)
            logger.info("Successfully updated entry")
            return True

        except Exception as e:
            logger.error(f"Error adding comment to column {column_name} in table {table_fqn}: {str(e)}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            return False

    def _get_table_draft_description(self, table_fqn: str) -> str:
        """Get the draft description for a table.

        Args:
            table_fqn (str): The fully qualified name of the table

        Returns:
            str: Draft description or None if not found
        """
        try:
            client = self._client._cloud_clients[constants["CLIENTS"]["DATAPLEX_CATALOG"]]
            project_id, dataset_id, table_id = self._client._utils.split_table_fqn(table_fqn)

            aspect_type = f"""projects/{self._client._project_id}/locations/global/aspectTypes/{constants["ASPECT_TEMPLATE"]["name"]}"""
            aspect_types = [aspect_type]
            entry_name = f"projects/{project_id}/locations/{self._client._dataplex_ops._get_dataset_location(table_fqn)}/entryGroups/@bigquery/entries/bigquery.googleapis.com/projects/{project_id}/datasets/{dataset_id}/tables/{table_id}"

            request = dataplex_v1.GetEntryRequest(
                name=entry_name,
                view=dataplex_v1.EntryView.CUSTOM,
                aspect_types=aspect_types
            )
            entry = client.get_entry(request=request)

            for aspect_key, aspect in entry.aspects.items():
                if aspect_key.endswith(f"""global.{constants["ASPECT_TEMPLATE"]["name"]}""") and aspect.path == "":
                    return aspect.data["contents"]

            return None
        except Exception as e:
            logger.error(f"Error getting draft description for table {table_fqn}: {str(e)}")
            return None

    def _get_column_draft_description(self, table_fqn: str, column_name: str) -> str:
        """Get the draft description for a column.

        Args:
            table_fqn (str): The fully qualified name of the table
            column_name (str): The name of the column

        Returns:
            str: Draft description or None if not found
        """
        try:
            client = self._client._cloud_clients[constants["CLIENTS"]["DATAPLEX_CATALOG"]]
            project_id, dataset_id, table_id = self._client._utils.split_table_fqn(table_fqn)

            aspect_type = f"""projects/{self._client._project_id}/locations/global/aspectTypes/{constants["ASPECT_TEMPLATE"]["name"]}"""
            aspect_types = [aspect_type]
            entry_name = f"projects/{project_id}/locations/{self._client._dataplex_ops._get_dataset_location(table_fqn)}/entryGroups/@bigquery/entries/bigquery.googleapis.com/projects/{project_id}/datasets/{dataset_id}/tables/{table_id}"

            request = dataplex_v1.GetEntryRequest(
                name=entry_name,
                view=dataplex_v1.EntryView.CUSTOM,
                aspect_types=aspect_types
            )
            entry = client.get_entry(request=request)

            for aspect_key, aspect in entry.aspects.items():
                if aspect_key.endswith(f"""global.{constants["ASPECT_TEMPLATE"]["name"]}@Schema.{column_name}""") and aspect.path == f"Schema.{column_name}":
                    return aspect.data["contents"]

            return None
        except Exception as e:
            logger.error(f"Error getting draft description for column {column_name} in table {table_fqn}: {str(e)}")
            return None 