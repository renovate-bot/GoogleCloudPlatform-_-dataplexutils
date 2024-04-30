import sys
sys.path.insert(1,'./src/package/')
print(sys.path)

from dataplexutils.metadata.wizard import Client 

PROJECT_ID = "jsk-dataplex-demo-380508"
DATASET_ID = "metadata_generation"
TABLE_ID = "cc"
LOCATION = "us-central1"

dw_client = Client(project_id=PROJECT_ID, location=LOCATION)

print(dw_client._get_table_profile_quality(f"{PROJECT_ID}.{DATASET_ID}.{TABLE_ID}"))


