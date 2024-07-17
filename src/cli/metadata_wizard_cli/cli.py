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
"""CLI interface to metadata wizard  API
   2024 Google
"""

# OS Imports
import argparse
import requests
import logging

logger = logging.getLogger(__name__)
# Set log level (optional)
logger.setLevel(logging.DEBUG) # or logging.INFO, logging.WARNING, etc.



def _call_api(
    service,
    scope,
    use_lineage_tables,
    use_lineage_processes,
    use_profile,
    use_data_quality,
    use_ext_documents,
    dataplex_project_id,
    llm_location,
    dataplex_location,
    documentation_uri,
    table_project_id,
    table_dataset_id,
    table_id,
    debug,
    documentation_csv_uri,
    strategy
):
    API_URL = f"https://{service}"
    API_URL_DEBUG = "http://localhost:8000"
    METADATA_TABLE_SCOPE_ROUTE = "/generate_table_description"
    METADATA_COLUMNS_SCOPE_ROUTE = "/generate_columns_descriptions"
    METADATA_DATASET_SCOPE_ROUTE = "/generate_dataset_tables_descriptions"

    if debug:
        API_URL = API_URL_DEBUG
    if scope == "table":
        url = API_URL + METADATA_TABLE_SCOPE_ROUTE
    elif scope == "columns":
        url = API_URL + METADATA_COLUMNS_SCOPE_ROUTE
    elif scope == "dataset":
        url = API_URL + METADATA_DATASET_SCOPE_ROUTE

    params = {
        "client_options_settings": {
            "use_lineage_tables": use_lineage_tables,
            "use_lineage_processes": use_lineage_processes,
            "use_profile": use_profile,
            "use_data_quality": use_data_quality,
            "use_ext_documents": use_ext_documents,
        },
        "client_settings": {
            "project_id": dataplex_project_id,
            "llm_location": llm_location,
            "dataplex_location": dataplex_location
        },
        "table_settings": {
            "project_id": table_project_id,
            "dataset_id": table_dataset_id,
            "table_id": table_id,
            "documentation_uri": documentation_uri
        },
        "dataset_settings": {
            "project_id": table_project_id,
            "dataset_id": table_dataset_id,
            "documentation_csv_uri": documentation_csv_uri,
            "strategy": strategy
        },
    }
    try:
        response = requests.post(url, json=params) 
        response.raise_for_status()  
        print(response.json())
        logger.debug(response.json())
    except requests.exceptions.RequestException as e:
        print(f"Error calling API: {e}")
    except requests.exceptions.JSONDecodeError as e:
        print(f"Error decoding JSON response: {e}")


def _get_input_arguments():
    """Argparse helper."""
    parser = argparse.ArgumentParser(description="Call Metadata Wizard API.")
    parser.add_argument("--service",
                        dest="service",
                        required=True,
                        type=str
                        )
    parser.add_argument("--scope",
                        dest="scope",
                        required=True,
                        type=str
                        )
    parser.add_argument(
        "--use_lineage_tables",
        dest="use_lineage_tables",
        required=False,
        default=False,
        type=bool
    )
    parser.add_argument(
        "--use_lineage_processes",
        dest="use_lineage_processes",
        required=False,
        default=False,
        type=bool
    )
    parser.add_argument(
        "--use_profile",
        dest="use_profile",
        required=False,
        default=False,
        type=bool
        )
    parser.add_argument(
        "--use_data_quality",
        dest="use_data_quality",
        required=False,
        default=False,
        type=bool
    )
    parser.add_argument(
        "--use_ext_documents",
        dest="use_ext_documents",
        required=False,
        default=False,
        type=bool
    )
    parser.add_argument(
        "--dataplex_project_id",
        dest="dataplex_project_id",
        required=True,
        type=str
    )
    parser.add_argument(
        "--llm_location",
        dest="llm_location",
        required=True,
        type=str
    )
    parser.add_argument(
        "--dataplex_location",
        dest="dataplex_location",
        required=True,
        type=str
    )
    parser.add_argument(
        "--documentation_uri",
        dest="documentation_uri",
        required=False,
        default="",
        type=str
    )
    parser.add_argument(
        "--table_project_id",
        dest="table_project_id",
        required=True,
        type=str
    )
    parser.add_argument(
        "--table_dataset_id",
        dest="table_dataset_id",
        required=True,
        type=str
    )
    parser.add_argument(
        "--table_id",
        dest="table_id",
        required=True,
        type=str
        )   
    parser.add_argument(
        "--debug",
        dest="debug",
        required=False,
        type=bool,
        default=False
        )
    parser.add_argument(
        "--strategy",
        dest="strategy",
        required=False,
        type=str,
        default="1"
        )

    parser.add_argument(
        "--documentation_csv_uri",
        dest="documentation_csv_uri",
        required=False,
        type=str,
        default=""
        )
    return parser.parse_args()


def main():
    args = _get_input_arguments()
    service = args.service
    scope = args.scope
    use_lineage_tables = args.use_lineage_tables
    use_lineage_processes = args.use_lineage_processes
    use_profile = args.use_profile
    use_data_quality = args.use_data_quality
    use_ext_documents = args.use_ext_documents
    dataplex_project_id = args.dataplex_project_id
    llm_location = args.llm_location
    dataplex_location = args.dataplex_location
    documentation_uri = args.documentation_uri
    table_project_id = args.table_project_id
    table_dataset_id = args.table_dataset_id
    table_id = args.table_id
    debug = args.debug
    strategy = args.strategy
    documentation_csv_uri = args.documentation_csv_uri
    _call_api(
        service,
        scope,
        use_lineage_tables,
        use_lineage_processes,
        use_profile,
        use_data_quality,
        use_ext_documents,
        dataplex_project_id,
        llm_location,
        dataplex_location,
        documentation_uri,
        table_project_id,
        table_dataset_id,
        table_id,
        debug,
        strategy,
        documentation_csv_uri
        
    )

if __name__ == "__main__":
    main()
