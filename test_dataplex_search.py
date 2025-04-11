#!/usr/bin/env python3
"""
Test script for diagnosing Dataplex Catalog API search functionality.
"""
import logging
import argparse
import traceback
from google.cloud import dataplex_v1

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("dataplex_search_test")
logger.setLevel(logging.DEBUG)

def test_search_entries(project_id, dataset_id, location="global"):
    """
    Test the Dataplex Catalog search_entries API call.
    
    Args:
        project_id (str): GCP project ID
        dataset_id (str): Dataset ID to search within
        location (str): Dataplex location (default: global)
    """
    try:
        logger.info(f"Testing search_entries for project {project_id} dataset {dataset_id}")
        
        # Create the Dataplex Catalog client
        client = dataplex_v1.CatalogServiceClient()
        
        # Build basic search query
        name = f"projects/{project_id}/locations/{location}"
        
        # Test with a simple system filter first
        simple_query = "system=BIGQUERY"
        logger.info(f"Testing with simple query: {simple_query}")
        
        # First test - basic query
        request = dataplex_v1.SearchEntriesRequest(
            name=name,
            query=simple_query,
            page_size=10
        )
        
        try:
            response = client.search_entries(request=request)
            # Process the first page of results
            result_count = 0
            for item in response:
                result_count += 1
                if hasattr(item, 'dataplex_entry') and hasattr(item.dataplex_entry, 'fully_qualified_name'):
                    logger.info(f"Found item: {item.dataplex_entry.fully_qualified_name}")
                else:
                    logger.info(f"Found item without full name: {item}")
            
            logger.info(f"Simple query returned {result_count} results")
            logger.info(f"Has next page: {bool(response.next_page_token)}")
            
        except Exception as e:
            logger.error(f"Error during basic search_entries call: {str(e)}")
            logger.error(traceback.format_exc())
            return False
        
        # Now try with the more complex query that's failing
        # Test with aspect filter
        if dataset_id:
            aspect_query = f"system=BIGQUERY and aspect:global.metadata-ai-generated.is-accepted=false AND parent:{dataset_id}"
        else:
            aspect_query = f"system=BIGQUERY and aspect:global.metadata-ai-generated.is-accepted=false"
            
        logger.info(f"Testing with aspect query: {aspect_query}")
        
        # Second test - complex query with aspect
        request = dataplex_v1.SearchEntriesRequest(
            name=name,
            query=aspect_query,
            page_size=10
        )
        
        try:
            response = client.search_entries(request=request)
            # Process the first page of results
            result_count = 0
            for item in response:
                result_count += 1
                if hasattr(item, 'dataplex_entry') and hasattr(item.dataplex_entry, 'fully_qualified_name'):
                    logger.info(f"Found item: {item.dataplex_entry.fully_qualified_name}")
                else:
                    logger.info(f"Found item without full name: {item}")
            
            logger.info(f"Aspect query returned {result_count} results")
            logger.info(f"Has next page: {bool(response.next_page_token)}")
            
        except Exception as e:
            logger.error(f"Error during aspect search_entries call: {str(e)}")
            logger.error(traceback.format_exc())
            return False
        
        # Try alternative aspect format
        alt_aspect_query = f"system=BIGQUERY AND entry.aspects:\"global.metadata-ai-generated\""
        if dataset_id:
            alt_aspect_query += f" AND parent:{dataset_id}"
            
        logger.info(f"Testing with alternative aspect query: {alt_aspect_query}")
        
        # Third test - alternative aspect query
        request = dataplex_v1.SearchEntriesRequest(
            name=name,
            query=alt_aspect_query,
            page_size=10
        )
        
        try:
            response = client.search_entries(request=request)
            # Process the first page of results
            result_count = 0
            for item in response:
                result_count += 1
                if hasattr(item, 'dataplex_entry') and hasattr(item.dataplex_entry, 'fully_qualified_name'):
                    logger.info(f"Found item: {item.dataplex_entry.fully_qualified_name}")
                else:
                    logger.info(f"Found item without full name: {item}")
            
            logger.info(f"Alternative aspect query returned {result_count} results")
            logger.info(f"Has next page: {bool(response.next_page_token)}")
            
        except Exception as e:
            logger.error(f"Error during alternative aspect search_entries call: {str(e)}")
            logger.error(traceback.format_exc())
            return False
        
        return True
        
    except Exception as e:
        logger.error(f"Error in test_search_entries: {str(e)}")
        logger.error(traceback.format_exc())
        return False

def test_list_entries(project_id, dataset_id=None, location="global"):
    """
    Test listing entries directly.
    
    Args:
        project_id (str): GCP project ID
        dataset_id (str): Dataset ID (optional)
        location (str): Dataplex location (default: global)
    """
    try:
        logger.info(f"Testing list_entries for project {project_id}")
        
        # Create the Dataplex Catalog client
        client = dataplex_v1.CatalogServiceClient()
        
        # Set the parent resource for the list request
        parent = f"projects/{project_id}/locations/{location}/entryGroups/-"
        
        # Create the list request
        request = dataplex_v1.ListEntriesRequest(
            parent=parent,
            page_size=10
        )
        
        try:
            response = client.list_entries(request=request)
            # Process the first page of results
            result_count = 0
            for item in response:
                result_count += 1
                if hasattr(item, 'fully_qualified_name'):
                    logger.info(f"Found entry: {item.fully_qualified_name}")
                else:
                    logger.info(f"Found entry: {item}")
            
            logger.info(f"List entries returned {result_count} results")
            logger.info(f"Has next page: {bool(response.next_page_token)}")
            
        except Exception as e:
            logger.error(f"Error during list_entries call: {str(e)}")
            logger.error(traceback.format_exc())
            return False
        
        return True
        
    except Exception as e:
        logger.error(f"Error in test_list_entries: {str(e)}")
        logger.error(traceback.format_exc())
        return False

def main():
    parser = argparse.ArgumentParser(description="Test Dataplex Catalog API")
    parser.add_argument("--project-id", required=True, help="Google Cloud project ID")
    parser.add_argument("--dataset-id", help="Dataset ID to search within (optional)")
    parser.add_argument("--location", default="global", help="Dataplex location (default: global)")
    args = parser.parse_args()
    
    logger.info("Starting Dataplex API tests")
    
    # Test search entries
    search_result = test_search_entries(args.project_id, args.dataset_id, args.location)
    logger.info(f"Search entries test {'succeeded' if search_result else 'failed'}")
    
    # Test list entries
    list_result = test_list_entries(args.project_id, args.dataset_id, args.location)
    logger.info(f"List entries test {'succeeded' if list_result else 'failed'}")
    
    logger.info("All tests completed")

if __name__ == "__main__":
    main() 