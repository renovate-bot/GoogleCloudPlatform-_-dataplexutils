from fastapi import FastAPI, Body, HTTPException, status
import dataplexutils.metadata.wizard as mw
from dataplexutils.metadata.wizard import Client, ClientOptions
from pydantic import BaseModel

app = FastAPI()


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
    documentation_uri: str
    dataset_location: str


class TableSettings(BaseModel):
    project_id: str
    dataset_id: str
    table_id: str


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
            documentation_uri=client_settings.documentation_uri,
            dataset_location=client_settings.dataset_location,
            client_options=client_options,
        )

        table_fqn = f"{table_settings.project_id}.{table_settings.dataset_id}.{table_settings.table_id}"
        client.generate_table_description(table_fqn)
        return {
            "message": "Table description generated successfully"
           
        }
    except Exception as e:
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
            client_options_settings.use_ext_documents,
        )
        client = Client(
            project_id=client_settings.project_id,
            llm_location=client_settings.llm_location,
            dataplex_location=client_settings.dataplex_location,
            documentation_uri=client_settings.documentation_uri,
            dataset_location=client_settings.dataset_location,
            client_options=client_options,
        )

        table_fqn = f"{table_settings.project_id}.{table_settings.dataset_id}.{table_settings.table_id}"
        client.generate_columns_descriptions(table_fqn)
        return {"message": "Column descriptions generated successfully"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        )
