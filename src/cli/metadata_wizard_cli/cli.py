#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""CLI interface to metadata wizard  API
   2024 Google
"""

# OS Imports
import argparse
import requests


def _call_api(service, scope, debug):
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

    params = {}
    response = requests.get(url, params=params)
    print(response.json())


def _get_input_arguments():
    """Argparse helper."""
    parser = argparse.ArgumentParser(description="Call Metadata Wizard API.")
    parser.add_argument("--service", dest="service", required=True)
    parser.add_argument("--scope", dest="scope", required=True)
    parser.add_argument("--debug", dest="debug", required=False)
    return parser.parse_args()


def main():
    args = _get_input_arguments()
    service = args.service
    scope = args.scope
    debug = args.debug
    _call_api(service, scope, debug)


if __name__ == "__main__":
    main()
