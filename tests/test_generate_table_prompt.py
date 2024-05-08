import sys
sys.path.insert(1,'./src/package/')
#print(sys.path)

from dataplexutils.metadata.wizard import Client,ClientOptions

PROJECT_ID = "jsk-dataplex-demo-380508"
DATASET_ID = "metadata_generation"
TABLE_ID = "cc"
DATAPLEX_LOCATION = "us-central1"
DATASET_LOCATION = "us"
MODEL_LOCATION = "us-central1"

client_options = ClientOptions(
    use_lineage_tables=True, use_lineage_processes=True, use_profile=True, use_ext_documents=True, use_data_quality=True)

client = Client(project_id=PROJECT_ID,model_location= MODEL_LOCATION,
                dataplex_location=DATAPLEX_LOCATION, dataset_location=DATASET_LOCATION,
                documentation_uri="gs://wizard-documents/ChicagoChrimesTable.pdf",
                client_options=client_options)

table_fqn = f"{PROJECT_ID}.{DATASET_ID}.{TABLE_ID}"



#dw_client = Client(project_id=PROJECT_ID, location=LOCATION)

client.generate_table_description(table_fqn)
#print(client._get_table_description(table_fqn))
#print(client._get_table_sources_info(table_fqn))
#print(client._get_job_sources(table_fqn))

