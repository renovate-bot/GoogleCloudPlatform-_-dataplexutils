from fastapi import FastAPI, Path, Query, HTTPException, status
import dataplexutils.metadata.wizard as mw
from dataplexutils.metadata.wizard import Client, ClientOptions
from pydantic import BaseModel

app = FastAPI()


class ClientOptionsSettings(BaseModel):
    use_lineage_tables: bool = False
    use_lineage_processes: bool = False
    use_profile: bool = False
    use_data_quality: bool = False


class ClientSettings(BaseModel):
    project_id: str
    location: str


class TableSettings(BaseModel):
    project_id: str
    dataset_id: str
    table_id: str


@app.get("/version")
def read_version():
    return {"version": mw.__version__}


@app.get("/generate_table_description")
def generate_table_description(
    client_options_settings: ClientOptionsSettings,
    client_settings: ClientSettings,
    table_settings: TableSettings,
):
    client_options = ClientOptions(
        client_options_settings.use_lineage_tables,
        client_options_settings.use_lineage_processes,
        client_options_settings.use_profile,
        client_options_settings.use_data_quality,
    )
    client = Client(
        project_id=client_settings.project_id,
        location=client_settings.location,
        client_options=client_options,
    )
    table_fqn = f"{table_settings.project_id}.{table_settings.dataset_id}.{table_settings.table_id}"
    client.generate_table_description(table_fqn)
