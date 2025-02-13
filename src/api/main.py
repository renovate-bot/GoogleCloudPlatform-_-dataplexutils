from fastapi import FastAPI, Depends, HTTPException, Body
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from typing import List
from urllib.parse import unquote
import logging
import traceback

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ClientSettings(BaseModel):
    project_id: str
    llm_location: str
    dataplex_location: str

class ClientSettingsRequest(BaseModel):
    client_settings: ClientSettings

app = FastAPI()

@app.post("/metadata/review")
async def get_review_items(request: ReviewRequest):
    try:
        wizard = MetadataWizard(
            project_id=request.client_settings.project_id,
            llm_location=request.client_settings.llm_location,
            dataplex_location=request.client_settings.dataplex_location
        )
        result = wizard.get_review_items()
        return {"data": result}
    except Exception as e:
        logger.error(f"Error getting review items: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get review items: {str(e)}"
        )

@app.post("/metadata/review/{table_fqn}")
async def get_review_item_details(
    table_fqn: str,
    request: ClientSettingsRequest
):
    """Get detailed information about a table.
    
    Args:
        table_fqn: The fully qualified name of the table (e.g., 'project.dataset.table')
        request: Request containing client settings
        
    Returns:
        Detailed information about the table
    """
    try:
        # Log the incoming request details
        logger.info("=== START: get_review_item_details ===")
        logger.info(f"Received table_fqn: {table_fqn}")
        logger.info(f"Request settings: project_id={request.client_settings.project_id}, "
                   f"llm_location={request.client_settings.llm_location}, "
                   f"dataplex_location={request.client_settings.dataplex_location}")
        
        # Decode the URL-encoded table FQN
        decoded_table_fqn = unquote(table_fqn)
        logger.info(f"Decoded table FQN: {decoded_table_fqn}")
        
        # Initialize wizard
        logger.info("Initializing MetadataWizard...")
        wizard = MetadataWizard(
            project_id=request.client_settings.project_id,
            llm_location=request.client_settings.llm_location,
            dataplex_location=request.client_settings.dataplex_location
        )
        
        # Get item details
        logger.info(f"Calling get_review_item_details with table_fqn: {decoded_table_fqn}")
        result = wizard.get_review_item_details(decoded_table_fqn)
        logger.info(f"Got result: {result}")
        
        response_data = {"data": result}
        logger.info(f"Returning response: {response_data}")
        logger.info("=== END: get_review_item_details ===")
        return response_data
        
    except Exception as e:
        logger.error("=== ERROR in get_review_item_details ===")
        logger.error(f"Error type: {type(e).__name__}")
        logger.error(f"Error message: {str(e)}")
        logger.error(f"Traceback:\n{traceback.format_exc()}")
        logger.error("=== END ERROR ===")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get review item details: {str(e)}"
        ) 