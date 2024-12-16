import sys
sys.path.append('/Users/jskuratowicz/Projects/Metadata Generation/src/package')

from dataplexutils.metadata.wizard import Client, ClientOptions

PROJECT_ID = "jsk-dataplex-demo-380508"
DATASET_ID = "metadata_generation"
TABLE_ID = "cc"
LLM_LOCATION = "us-central1"
DATAPLEX_LOCATION =  "us-central1"
DOCUMENTATION_URI = "us-central1"

client_options = ClientOptions(
    use_lineage_tables=True,
    use_lineage_processes=True,
    use_profile=True,
    use_data_quality=False,
    use_ext_documents=False,
    add_ai_warning=True,
    )

client = Client(
    project_id=PROJECT_ID,
    llm_location=LLM_LOCATION,
    dataplex_location=DATAPLEX_LOCATION,
    client_options=client_options,
)

table_fqn = f"{PROJECT_ID}.{DATASET_ID}.{TABLE_ID}"


     
client._update_table_dataplex_description(table_fqn, "===AI generated description===\n AXYSDASASDASD</p>")