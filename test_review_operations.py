#!/usr/bin/env python3
"""
Test script for diagnosing the ReviewOperations.get_review_items_for_dataset method.
"""
import logging
import argparse
import traceback
import json
import sys

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("review_operations_test")
logger.setLevel(logging.DEBUG)

def test_review_operations(project_id, dataset_id=None, dataplex_location="global", 
                          llm_location="us-central1"):
    """
    Test the ReviewOperations.get_review_items_for_dataset method.
    
    Args:
        project_id (str): GCP project ID
        dataset_id (str): Dataset ID to search within (optional)
        dataplex_location (str): Dataplex location (default: global)
        llm_location (str): LLM API location (default: us-central1)
    """
    try:
        # Try to import the Client and ReviewOperations classes
        try:
            # Assume the package is installed and importable
            from dataplexutils.metadata.client import Client
        except ImportError:
            # If not installed, try to add src/package to PYTHONPATH
            logger.info("Could not import Client, trying to add package path")
            sys.path.append("src/package")
            try:
                from dataplexutils.metadata.client import Client
            except ImportError:
                logger.error("Could not import dataplexutils.metadata.client. Please check your PYTHONPATH.")
                return False
                
        logger.info(f"Testing ReviewOperations for project {project_id}")
        
        # Create the client
        client = Client(
            project_id=project_id,
            llm_location=llm_location,
            dataplex_location=dataplex_location
        )
        
        # Get the ReviewOperations instance
        review_ops = client._review_ops
        
        # Test the method directly
        try:
            logger.info(f"Testing get_review_items_for_dataset with dataset: {dataset_id}")
            
            # Testing different variations to debug the issue
            # Test 1: Direct call to method with dataset_fqn
            try:
                dataset_fqn = dataset_id if dataset_id else f"{project_id}.metadata_generation"
                result = review_ops.get_review_items_for_dataset(dataset_fqn=dataset_fqn)
                logger.info(f"Result: {json.dumps(result, default=str)}")
                logger.info("Direct call to get_review_items_for_dataset succeeded")
            except Exception as e:
                logger.error(f"Error in direct call to get_review_items_for_dataset: {str(e)}")
                logger.error(traceback.format_exc())
                
            # Test 2: Try with explicit search_query=None
            try:
                dataset_fqn = dataset_id if dataset_id else f"{project_id}.metadata_generation"
                result = review_ops.get_review_items_for_dataset(dataset_fqn=dataset_fqn, search_query=None)
                logger.info(f"Result with explicit search_query=None: {json.dumps(result, default=str)}")
                logger.info("Call with explicit search_query=None succeeded")
            except Exception as e:
                logger.error(f"Error in call with explicit search_query=None: {str(e)}")
                logger.error(traceback.format_exc())
                
            # Test 3: With a simpler search query
            try:
                dataset_fqn = dataset_id if dataset_id else f"{project_id}.metadata_generation"
                result = review_ops.get_review_items_for_dataset(dataset_fqn=dataset_fqn, search_query="system=BIGQUERY")
                logger.info(f"Result with simple search_query: {json.dumps(result, default=str)}")
                logger.info("Call with simple search_query succeeded")
            except Exception as e:
                logger.error(f"Error in call with simple search_query: {str(e)}")
                logger.error(traceback.format_exc())
                
            # Test 4: With only the dataset filter
            try:
                dataset_fqn = dataset_id if dataset_id else f"{project_id}.metadata_generation"
                search_query = f"parent:{dataset_fqn}"
                result = review_ops.get_review_items_for_dataset(dataset_fqn=dataset_fqn, search_query=search_query)
                logger.info(f"Result with dataset filter only: {json.dumps(result, default=str)}")
                logger.info("Call with dataset filter only succeeded")
            except Exception as e:
                logger.error(f"Error in call with dataset filter only: {str(e)}")
                logger.error(traceback.format_exc())
                
            # Test 5: Examine the build_search_query_for_review method
            try:
                dataset_fqn = dataset_id if dataset_id else f"{project_id}.metadata_generation"
                query = review_ops.build_search_query_for_review(dataset_fqn=dataset_fqn)
                logger.info(f"Built search query: {query}")
                
                # The query from build_search_query_for_review is causing the issue, let's modify it slightly
                modified_query = f"system=BIGQUERY AND parent:{dataset_fqn}"
                logger.info(f"Modified search query: {modified_query}")
                
                # Try with modified query to see if removing aspects helps
                try:
                    from google.cloud import dataplex_v1
                    client = dataplex_v1.CatalogServiceClient()
                    name = f"projects/{project_id}/locations/global"
                    
                    request = dataplex_v1.SearchEntriesRequest(
                        name=name,
                        query=modified_query,
                        page_size=10
                    )
                    
                    response = client.search_entries(request=request)
                    result_count = sum(1 for _ in response)
                    logger.info(f"Modified query test returned {result_count} results")
                except Exception as e:
                    logger.error(f"Error with modified query test: {str(e)}")
                    logger.error(traceback.format_exc())
                
            except Exception as e:
                logger.error(f"Error examining build_search_query_for_review: {str(e)}")
                logger.error(traceback.format_exc())
                
            return True
            
        except Exception as e:
            logger.error(f"Error testing get_review_items_for_dataset: {str(e)}")
            logger.error(traceback.format_exc())
            return False
        
    except Exception as e:
        logger.error(f"Error in test_review_operations: {str(e)}")
        logger.error(traceback.format_exc())
        return False

def main():
    parser = argparse.ArgumentParser(description="Test ReviewOperations get_review_items_for_dataset")
    parser.add_argument("--project-id", required=True, help="Google Cloud project ID")
    parser.add_argument("--dataset-id", help="Dataset ID to search within (optional)")
    parser.add_argument("--dataplex-location", default="global", help="Dataplex location (default: global)")
    parser.add_argument("--llm-location", default="us-central1", help="LLM API location (default: us-central1)")
    args = parser.parse_args()
    
    logger.info("Starting ReviewOperations tests")
    
    # Test review operations
    result = test_review_operations(
        args.project_id,
        args.dataset_id,
        args.dataplex_location,
        args.llm_location
    )
    
    logger.info(f"ReviewOperations test {'succeeded' if result else 'failed'}")
    
    logger.info("All tests completed")

if __name__ == "__main__":
    main() 