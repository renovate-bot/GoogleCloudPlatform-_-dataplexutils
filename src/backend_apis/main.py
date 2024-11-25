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
            stage_for_review=client_options_settings.stage_for_review
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
            client_options_settings.use_lineage_tables,
            client_options_settings.use_lineage_processes,
            client_options_settings.use_profile,
            client_options_settings.use_data_quality,
            client_options_settings.use_ext_documents,
            client_options_settings.persist_to_dataplex_catalog,
            client_options_settings.stage_for_review
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
            client_options_settings.stage_for_review
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
            client_options_settings.stage_for_review
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
