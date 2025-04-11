# Dataplex API Testing

This document provides instructions for diagnosing issues with the Dataplex Catalog API in the Metadata Generation application.

## Problem Description

The application is experiencing 404/501 errors when trying to retrieve metadata review items through the Dataplex Catalog API, specifically when using the `search_entries` method with aspect-based queries.

Error message:
```
ERROR:wizard_logger:Error during search_entries call: 501 Received http2 header with status: 404
ERROR:wizard_logger:Error getting review items for search query 'None': 501 Received http2 header with status: 404
ERROR:main:Error getting review items: 501 Received http2 header with status: 404
```

## Test Scripts

Two test scripts have been created to help diagnose the issue:

1. `test_dataplex_search.py`: Tests the Dataplex Catalog API search functionality directly
2. `test_review_operations.py`: Tests the `ReviewOperations.get_review_items_for_dataset` method

### Running the Dataplex Search Test

This script tests various search queries against the Dataplex Catalog API to identify which types of queries are failing.

```bash
python test_dataplex_search.py --project-id YOUR_PROJECT_ID [--dataset-id DATASET_ID] [--location LOCATION]
```

Arguments:
- `--project-id`: (Required) Your Google Cloud project ID
- `--dataset-id`: (Optional) The dataset ID to search within
- `--location`: (Optional) The Dataplex location (default: "global")

### Running the Review Operations Test

This script tests the `ReviewOperations.get_review_items_for_dataset` method with different arguments to identify what's causing the error.

```bash
python test_review_operations.py --project-id YOUR_PROJECT_ID [--dataset-id DATASET_ID] [--dataplex-location LOCATION] [--llm-location LLM_LOCATION]
```

Arguments:
- `--project-id`: (Required) Your Google Cloud project ID
- `--dataset-id`: (Optional) The dataset ID to search within
- `--dataplex-location`: (Optional) The Dataplex location (default: "global")
- `--llm-location`: (Optional) The LLM API location (default: "us-central1")

## Applied Fixes

Two fixes have been applied to the codebase to make it more resilient to these errors:

1. Updated the `/metadata/review` endpoint in `main.py` to catch specific 404/501 errors and return an empty result set with an error message.

2. Updated the `get_review_items_for_dataset` method in `ReviewOperations` to implement a fallback approach that uses a simpler query without aspects if the aspect-based query fails.

## Possible Root Causes

Potential root causes of the issue include:

1. **Missing Aspect Type**: The aspect type `global.metadata-ai-generated` might not be properly created or registered in Dataplex.

2. **API Access Issues**: The service account might not have proper permissions to use the Dataplex Catalog API.

3. **Query Syntax**: The aspect query syntax might be incorrect or unsupported in the current Dataplex version.

4. **Dataplex API Changes**: Recent changes to the Dataplex API might have affected the way aspect-based queries work.

## Recommended Next Steps

1. Run the test scripts to identify which types of queries are failing.

2. Check the Dataplex Catalog API service status in your project.

3. Verify that the aspect types mentioned in the code are properly created in Dataplex.

4. Check permissions for the service account being used.

5. Consider contacting Google Cloud Support if the issue persists, providing them with the detailed logs from the test scripts. 