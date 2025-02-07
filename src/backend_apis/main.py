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

from fastapi import FastAPI, Body, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import dataplexutils.metadata.wizard as mw
from dataplexutils.metadata.wizard import Client, ClientOptions
from pydantic import BaseModel
import logging
import datetime

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = FastAPI()

class ClientOptionsSettings(BaseModel):
    use_lineage_tables: bool
    use_lineage_processes: bool
    use_profile: bool
    use_data_quality: bool
    use_ext_documents: bool
    persist_to_dataplex_catalog: bool
    stage_for_review: bool
    top_values_in_description: bool
    description_handling: str
    description_prefix: str


class ClientSettings(BaseModel):
    project_id: str
    llm_location: str
    dataplex_location: str


class TableSettings(BaseModel):
    project_id: str
    dataset_id: str
    table_id: str
    documentation_uri: str

class DatasetSettings(BaseModel):
    project_id: str
    dataset_id: str
    documentation_csv_uri: str
    strategy: str

class ColumnSettings(BaseModel):
    column_name: str

class RegenerationCounts(BaseModel):
    tables: int
    columns: int

class RegenerationRequest(BaseModel):
    objects: list[str]

class MarkForRegenerationRequest(BaseModel):
    table_fqn: str
    column_name: str | None = None

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for debugging
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/version")
def read_version():
    return {"version": mw.__version__}


@app.post("/generate_table_description")
def generate_table_description(
    client_options_settings: ClientOptionsSettings = Body(),
    client_settings: ClientSettings = Body(),
    table_settings: TableSettings = Body(),
    dataset_settings: DatasetSettings = Body(),
):
 
    """
        Generates a table description in Dataplex using the provided settings.

        Args:
            client_options_settings: Configuration for the Dataplex client options.
            client_settings: Project and location details.
            table_settings: Table identifier information.

        Returns:
            The result of the table description generation process, or an error
            message if something goes wrong.

    """
    try:
        print("Client options class definition: ",ClientOptions.__dict__)
        client_options = ClientOptions(
            use_lineage_tables=client_options_settings.use_lineage_tables,
            use_lineage_processes=client_options_settings.use_lineage_processes,
            use_profile=client_options_settings.use_profile,
            use_data_quality=client_options_settings.use_data_quality,
            use_ext_documents=client_options_settings.use_ext_documents,
            persist_to_dataplex_catalog=client_options_settings.persist_to_dataplex_catalog,
            stage_for_review=client_options_settings.stage_for_review,
            top_values_in_description=client_options_settings.top_values_in_description,
            description_handling=client_options_settings.description_handling,
            description_prefix=client_options_settings.description_prefix
        )
        client = Client(
            project_id=client_settings.project_id,
            llm_location=client_settings.llm_location,
            dataplex_location=client_settings.dataplex_location,
            client_options=client_options
        )
        table_fqn = f"{table_settings.project_id}.{table_settings.dataset_id}.{table_settings.table_id}"
        logger.info(f"Received arguments: {client_options_settings}, {client_settings}, {table_settings}")
        logger.info(f"Generating for table: {table_fqn}")
        client.generate_table_description(table_fqn,table_settings.documentation_uri)
        return {
            "message": "Table description generated successfully"
           
        }
    except Exception as e:
        logger.exception("An error occurred while generating table descriptions") 
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        )

@app.post("/generate_columns_descriptions")
def generate_columns_descriptions(
    client_options_settings: ClientOptionsSettings = Body(),
    client_settings: ClientSettings = Body(),
    table_settings: TableSettings = Body(),
    dataset_settings: DatasetSettings = Body(),
):
    try:
        client_options = ClientOptions(
            use_lineage_tables=client_options_settings.use_lineage_tables,
            use_lineage_processes=client_options_settings.use_lineage_processes,
            use_profile=client_options_settings.use_profile,
            use_data_quality=client_options_settings.use_data_quality,
            use_ext_documents=client_options_settings.use_ext_documents,
            persist_to_dataplex_catalog=client_options_settings.persist_to_dataplex_catalog,
            stage_for_review=client_options_settings.stage_for_review,
            top_values_in_description=client_options_settings.top_values_in_description,
            description_handling=client_options_settings.description_handling,
            description_prefix=client_options_settings.description_prefix
        )
        client = Client(
            project_id=client_settings.project_id,
            llm_location=client_settings.llm_location,
            dataplex_location=client_settings.dataplex_location,
            client_options=client_options
        )

        table_fqn = f"{table_settings.project_id}.{table_settings.dataset_id}.{table_settings.table_id}"
        client.generate_columns_descriptions(table_fqn, table_settings.documentation_uri)
        return {"message": "Column descriptions generated successfully"}
    except Exception as e:
        logger.exception("An error occurred while generating column descriptions") 
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        )

@app.post("/generate_dataset_tables_descriptions")
def generate_dataset_tables_descriptions(
    client_options_settings: ClientOptionsSettings = Body(),
    client_settings: ClientSettings = Body(),
    table_settings: TableSettings = Body(),
    dataset_settings: DatasetSettings = Body(),
):
    """
        Generates a table description in Dataplex using the provided settings.

        Args:
            client_options_settings: Configuration for the Dataplex client options.
            client_settings: Project and location details.
            dataset_settings: Dataset identifier information.
        
        Returns:
            The result of the multiple table description generation process, or an error
            message if something goes wrong.
    
    """
    try:
        logger.debug("Generating dataset tables request")
        client_options = ClientOptions(
            client_options_settings.use_lineage_tables,
            client_options_settings.use_lineage_processes,
            client_options_settings.use_profile,
            client_options_settings.use_data_quality,
            client_options_settings.use_ext_documents,
            client_options_settings.persist_to_dataplex_catalog,
            client_options_settings.stage_for_review,
            client_options_settings.top_values_in_description,
            client_options_settings.description_handling,
            client_options_settings.description_prefix
        )
        client = Client(
            project_id=client_settings.project_id,
            llm_location=client_settings.llm_location,
            dataplex_location=client_settings.dataplex_location,        
            client_options=client_options,
            
        )

        dataset_fqn = f"{dataset_settings.project_id}.{dataset_settings.dataset_id}"
        logger.info(f"Received arguments: {client_options_settings}, {client_settings}, {dataset_settings}")
        logger.info(f"Generating for dataset: {dataset_fqn}")
        client.generate_dataset_tables_descriptions(dataset_fqn,dataset_settings.strategy,dataset_settings.documentation_csv_uri)
        return {"message": "Dataset table descriptions generated successfully"}
    except Exception as e:
        logger.exception("An error occurred while generating dataset descriptions") 
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        )

@app.post("/generate_dataset_tables_columns_descriptions")
def generate_dataset_tables_columns_descriptions(
    client_options_settings: ClientOptionsSettings = Body(),
    client_settings: ClientSettings = Body(),
    table_settings: TableSettings = Body(),
    dataset_settings: DatasetSettings = Body(),
):
    """
        Generates a table description in Dataplex using the provided settings.

        Args:
            client_options_settings: Configuration for the Dataplex client options.
            client_settings: Project and location details.
            dataset_settings: Dataset identifier information.
        
        Returns:
            The result of the multiple table description generation process, or an error
            message if something goes wrong.
    
    """
    try:
        logger.debug("Generating dataset tables request")
        client_options = ClientOptions(
            client_options_settings.use_lineage_tables,
            client_options_settings.use_lineage_processes,
            client_options_settings.use_profile,
            client_options_settings.use_data_quality,
            client_options_settings.use_ext_documents,
            client_options_settings.persist_to_dataplex_catalog,
            client_options_settings.stage_for_review,
            client_options_settings.top_values_in_description,
            client_options_settings.description_handling,
            client_options_settings.description_prefix
        )
        client = Client(
            project_id=client_settings.project_id,
            llm_location=client_settings.llm_location,
            dataplex_location=client_settings.dataplex_location,        
            client_options=client_options,            
        )

        dataset_fqn = f"{dataset_settings.project_id}.{dataset_settings.dataset_id}"
        logger.info(f"Received arguments: {client_options_settings}, {client_settings}, {dataset_settings}")
        logger.info(f"Generating for dataset: {dataset_fqn}")
        client.generate_dataset_tables_columns_descriptions(dataset_fqn,dataset_settings.strategy,dataset_settings.documentation_csv_uri)
        return {"message": "Dataset table columns descriptions generated successfully"}
    except Exception as e:
        logger.exception("An error occurred while generating dataset descriptions") 
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        )

@app.post("/accept_table_draft_description")
def accept_table_draft_description(
    client_options_settings: ClientOptionsSettings = Body(),
    client_settings: ClientSettings = Body(),
    table_settings: TableSettings = Body(),
    dataset_settings: DatasetSettings = Body(),
):
    """
    Accepts the draft description for a table, promoting it to the actual table description.

    Args:
        client_options_settings: Configuration for the Dataplex client options.
        client_settings: Project and location details.
        table_settings: Table identifier information.

    Returns:
        A message indicating success or failure.
    """
    try:
        client_options = ClientOptions(
            use_lineage_tables=client_options_settings.use_lineage_tables,
            use_lineage_processes=client_options_settings.use_lineage_processes,
            use_profile=client_options_settings.use_profile,
            use_data_quality=client_options_settings.use_data_quality,
            use_ext_documents=client_options_settings.use_ext_documents,
            persist_to_dataplex_catalog=client_options_settings.persist_to_dataplex_catalog,
            stage_for_review=client_options_settings.stage_for_review,
            description_handling=client_options_settings.description_handling,
            description_prefix=client_options_settings.description_prefix
        )
        client = Client(
            project_id=client_settings.project_id,
            llm_location=client_settings.llm_location,
            dataplex_location=client_settings.dataplex_location,
            client_options=client_options
        )

        table_fqn = f"{table_settings.project_id}.{table_settings.dataset_id}.{table_settings.table_id}"
        logger.info(f"Accepting draft description for table: {table_fqn}")
        client.accept_table_draft_description(table_fqn)
        return {"message": "Table draft description accepted successfully"}
    except Exception as e:
        logger.exception("An error occurred while accepting table draft description") 
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        )

@app.post("/accept_column_draft_description")
def accept_column_draft_description(
    client_options_settings: ClientOptionsSettings = Body(),
    client_settings: ClientSettings = Body(),
    table_settings: TableSettings = Body(),
    dataset_settings: DatasetSettings = Body(),
    column_settings: ColumnSettings = Body()
):
    """
    Accepts the draft description for a column, promoting it to the actual column description.

    Args:
        client_options_settings: Configuration for the Dataplex client options.
        client_settings: Project and location details.
        table_settings: Table identifier information.
        column_settings: Column identifier information.

    Returns:
        A message indicating success or failure.
    """
    try:
        client_options = ClientOptions(
            use_lineage_tables=client_options_settings.use_lineage_tables,
            use_lineage_processes=client_options_settings.use_lineage_processes,
            use_profile=client_options_settings.use_profile,
            use_data_quality=client_options_settings.use_data_quality,
            use_ext_documents=client_options_settings.use_ext_documents,
            persist_to_dataplex_catalog=client_options_settings.persist_to_dataplex_catalog,
            stage_for_review=client_options_settings.stage_for_review,
            description_handling=client_options_settings.description_handling,
            description_prefix=client_options_settings.description_prefix
        )
        client = Client(
            project_id=client_settings.project_id,
            llm_location=client_settings.llm_location,
            dataplex_location=client_settings.dataplex_location,
            client_options=client_options
        )

        table_fqn = f"{table_settings.project_id}.{table_settings.dataset_id}.{table_settings.table_id}"
        logger.info(f"Accepting draft description for column {column_settings.column_name} in table: {table_fqn}")
        client.accept_column_draft_description(table_fqn, column_settings.column_name)
        return {"message": f"Column {column_settings.column_name} draft description accepted successfully"}
    except Exception as e:
        logger.exception("An error occurred while accepting column draft description") 
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        )

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    logger.error(f"HTTP error occurred: {exc.detail}")
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )

@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info(f"Request: {request.method} {request.url}")
    logger.debug(f"Headers: {request.headers}")
    body = await request.body()
    logger.debug(f"Body: {body.decode()}")
    response = await call_next(request)
    return response

# Regeneration Management APIs
@app.get("/get_regeneration_counts")
def get_regeneration_counts(
    client_settings: ClientSettings = Body(),
    dataset_settings: DatasetSettings = Body(),
):
    try:
        client = mw.Client(
            project_id=client_settings.project_id,
            llm_location=client_settings.llm_location,
            dataplex_location=client_settings.dataplex_location,
        )
        
        dataset_fqn = f"{dataset_settings.project_id}.{dataset_settings.dataset_id}"
        tables_count = client._list_tables_in_dataset_for_regeneration(dataset_fqn)
        
        return RegenerationCounts(
            tables=len(tables_count),
            columns=0  # TODO: Implement column counting
        )
    except Exception as e:
        logger.error(f"Error in get_regeneration_counts: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@app.post("/regenerate_selected")
def regenerate_selected(
    client_options_settings: ClientOptionsSettings = Body(),
    client_settings: ClientSettings = Body(),
    regeneration_request: RegenerationRequest = Body(),
):
    try:
        client = mw.Client(
            project_id=client_settings.project_id,
            llm_location=client_settings.llm_location,
            dataplex_location=client_settings.dataplex_location,
            client_options=mw.ClientOptions(**client_options_settings.dict())
        )
        
        results = []
        for obj in regeneration_request.objects:
            # TODO: Implement regeneration logic for individual objects
            # This should handle both tables and columns
            results.append({"object": obj, "status": "regenerated"})
        
        return {"regenerated_objects": results}
    except Exception as e:
        logger.error(f"Error in regenerate_selected: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@app.post("/regenerate_all")
def regenerate_all(
    client_options_settings: ClientOptionsSettings = Body(),
    client_settings: ClientSettings = Body(),
    dataset_settings: DatasetSettings = Body(),
):
    try:
        client = mw.Client(
            project_id=client_settings.project_id,
            llm_location=client_settings.llm_location,
            dataplex_location=client_settings.dataplex_location,
            client_options=mw.ClientOptions(**client_options_settings.dict())
        )
        
        dataset_fqn = f"{dataset_settings.project_id}.{dataset_settings.dataset_id}"
        tables = client._list_tables_in_dataset_for_regeneration(dataset_fqn)
        
        results = []
        for table in tables:
            # TODO: Implement regeneration logic for all marked objects
            results.append({"table": table, "status": "regenerated"})
        
        return {"regenerated_objects": results}
    except Exception as e:
        logger.error(f"Error in regenerate_all: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

# Review Management Models
class Comment(BaseModel):
    id: str
    text: str
    type: str
    timestamp: str

class MetadataItem(BaseModel):
    id: str
    type: str
    name: str
    currentDescription: str
    draftDescription: str
    isHtml: bool
    status: str
    lastModified: str
    comments: list[Comment]
    markedForRegeneration: bool = False

# Review Management APIs
@app.post("/metadata/review")
def get_review_items(
    client_settings: ClientSettings = Body(),
    dataset_settings: DatasetSettings = Body(),
):
    try:
        client = mw.Client(
            project_id=client_settings.project_id,
            llm_location=client_settings.llm_location,
            dataplex_location=client_settings.dataplex_location,
        )
        
        # Ensure both project_id and dataset_id are provided
        if not dataset_settings.project_id or not dataset_settings.dataset_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Both project_id and dataset_id must be provided"
            )
        
        # Construct the dataset FQN in the correct format: project.dataset
        dataset_fqn = f"{dataset_settings.project_id}.{dataset_settings.dataset_id}"
        logger.info(f"Getting review items for dataset {dataset_fqn}")
        
        try:
            return client._get_review_items_for_dataset(dataset_fqn)
        except Exception as e:
            logger.error(f"Error getting review items for dataset {dataset_fqn}: {str(e)}")
            return {
                "data": {
                    "items": [],
                    "nextPageToken": None,
                    "totalCount": 0
                }
            }
            
    except Exception as e:
        logger.error(f"Error in get_review_items: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@app.post("/metadata/review/{id}/accept")
def accept_review_item(
    id: str,
    client_settings: ClientSettings = Body(),
):
    try:
        client = mw.Client(
            project_id=client_settings.project_id,
            llm_location=client_settings.llm_location,
            dataplex_location=client_settings.dataplex_location,
        )
        
        result = client.accept_review_item(id)
        return {"status": "accepted", "id": id, **result}
    except Exception as e:
        logger.error(f"Error in accept_review_item: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@app.post("/metadata/review/{id}/reject")
def reject_review_item(
    id: str,
    client_settings: ClientSettings = Body(),
):
    try:
        client = mw.Client(
            project_id=client_settings.project_id,
            llm_location=client_settings.llm_location,
            dataplex_location=client_settings.dataplex_location,
        )
        
        result = client.reject_review_item(id)
        return {"status": "rejected", "id": id, **result}
    except Exception as e:
        logger.error(f"Error in reject_review_item: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@app.post("/metadata/review/{id}/edit")
def edit_review_item(
    id: str,
    client_settings: ClientSettings = Body(),
    description: str = Body(..., embed=True),
):
    try:
        client = mw.Client(
            project_id=client_settings.project_id,
            llm_location=client_settings.llm_location,
            dataplex_location=client_settings.dataplex_location,
        )
        
        result = client.edit_review_item(id, description)
        return {"status": "updated", "id": id, **result}
    except Exception as e:
        logger.error(f"Error in edit_review_item: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@app.post("/metadata/review/{id}/comment")
def add_review_comment(
    id: str,
    client_settings: ClientSettings = Body(),
    comment: str = Body(..., embed=True),
):
    try:
        client = mw.Client(
            project_id=client_settings.project_id,
            llm_location=client_settings.llm_location,
            dataplex_location=client_settings.dataplex_location,
        )
        
        # TODO: Implement comment logic
        return {
            "status": "added",
            "id": id,
            "comment": {
                "id": "new_comment_id",
                "text": comment,
                "type": "human",
                "timestamp": datetime.datetime.now().isoformat()
            }
        }
    except Exception as e:
        logger.error(f"Error in add_review_comment: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@app.post("/mark_for_regeneration")
def mark_for_regeneration(
    client_settings: ClientSettings = Body(),
    request: MarkForRegenerationRequest = Body(),
):
    """Mark a table or column for regeneration.

    If column_name is provided, marks the specific column for regeneration.
    If only table_fqn is provided, marks the entire table for regeneration.
    """
    try:
        client = mw.Client(
            project_id=client_settings.project_id,
            llm_location=client_settings.llm_location,
            dataplex_location=client_settings.dataplex_location,
        )
        
        if request.column_name:
            success = client.mark_column_for_regeneration(request.table_fqn, request.column_name)
            if success:
                return {"message": f"Column {request.column_name} in table {request.table_fqn} marked for regeneration"}
            else:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to mark column {request.column_name} for regeneration"
                )
        else:
            success = client.mark_table_for_regeneration(request.table_fqn)
            if success:
                return {"message": f"Table {request.table_fqn} marked for regeneration"}
            else:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to mark table {request.table_fqn} for regeneration"
                )
    except Exception as e:
        logger.error(f"Error in mark_for_regeneration: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
