from  metadata.metadata import _get_entry_details,_search_data_catalog,_get_entry_details,get_dependencies_info,_get_table_profile,generate_table_description


entry_id = "//bigquery.googleapis.com/projects/jsk-dataplex-demo-380508/datasets/metadata_generation/tables/ccagg"


result = _get_entry_details(entry_id)  # Replace this with your function to get a result by ID
print("generate():result['fullyQualifiedName']:",result['fullyQualifiedName'])
additional_info=get_dependencies_info(result['fullyQualifiedName'])

print(result)
