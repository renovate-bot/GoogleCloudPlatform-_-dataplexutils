from fastapi import FastAPI, Body, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
import dataplexutils.metadata.wizard as mw
from dataplexutils.metadata.wizard import Client, ClientOptions
from pydantic import BaseModel

app = FastAPI()

import logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)
# Set log level (optional)

class ClientOptionsSettings(BaseModel):
    use_lineage_tables: bool
    use_lineage_processes: bool
    use_profile: bool
    use_data_quality: bool
    use_ext_documents: bool


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


app.add_middleware(
    CORSMiddleware,
    # @velascoluis - This is for the local frontend
    allow_origins=["http://localhost:3000"],
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
        client_options = ClientOptions(
            client_options_settings.use_lineage_tables,
            client_options_settings.use_lineage_processes,
            client_options_settings.use_profile,
            client_options_settings.use_data_quality,
            client_options_settings.use_ext_documents
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
):
    try:
        client_options = ClientOptions(
            client_options_settings.use_lineage_tables,
            client_options_settings.use_lineage_processes,
            client_options_settings.use_profile,
            client_options_settings.use_data_quality,
            client_options_settings.use_ext_documents
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
        )
        client = Client(
            project_id=client_settings.project_id,
            llm_location=client_settings.llm_location,
            dataplex_location=client_settings.dataplex_location,        
            client_options=client_options,
            
        )
        print("NO KURWA")
        dataset_fqn = f"{dataset_settings.project_id}.{dataset_settings.dataset_id}"
        logger.info(f"Received arguments: {client_options_settings}, {client_settings}, {dataset_settings}")
        logger.info(f"Generating for dataset: {dataset_fqn}")
        client.generate_dataset_tables_descriptions(dataset_fqn,dataset_settings.documentation_csv_uri)
        return {"message": "Dataset table descriptions generated successfully"}
    except Exception as e:
        logger.exception("An error occurred while generating dataset descriptions") 
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        )
