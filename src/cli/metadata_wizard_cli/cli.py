#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""CLI interface to metadata wizard  API
   2024 Google
"""

# OS Imports
import argparse
import requests


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
    dataset_location,
    table_project_id,
    table_dataset_id,
    table_id,
    debug,
):
    API_URL = f"https://{service}"
    API_URL_DEBUG = "http://localhost:8080"
    METADATA_TABLE_SCOPE_ROUTE = "/generate_table_description"
    METADATA_COLUMNS_SCOPE_ROUTE = "/generate_columns_descriptions"

    if debug:
        API_URL = API_URL_DEBUG
    if scope == "table":
        url = API_URL + METADATA_TABLE_SCOPE_ROUTE
    elif scope == "columns":
        url = API_URL + METADATA_COLUMNS_SCOPE_ROUTE

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
            "dataplex_location": dataplex_location,
            "documentation_uri": documentation_uri,
            "dataset_location": dataset_location,
        },
        "table_settings": {
            "project_id": table_project_id,
            "dataset_id": table_dataset_id,
            "table_id": table_id
        },
    }
    try:
        response = requests.post(url, json=params)  
        response.raise_for_status()  
        print(response.json())
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
        "--dataset_location",
        dest="dataset_location",
        required=True,
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
    dataset_location = args.dataset_location
    table_project_id = args.table_project_id
    table_dataset_id = args.table_dataset_id
    table_id = args.table_id
    debug = args.debug
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
        dataset_location,
        table_project_id,
        table_dataset_id,
        table_id,
        debug,
    )


if __name__ == "__main__":
    main()
