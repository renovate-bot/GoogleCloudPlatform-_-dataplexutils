from metadata_v2.metadata_v2 import MetadataWizard

wizard = MetadataWizard("czaruś", project_id="jsk-dataplex-demo-380508")


print(wizard.get_dependencies_info(tablename="bigquery:jsk-dataplex-demo-380508.metadata_generation.cc"))
#entry_id="//bigquery.googleapis.com/projects/jsk-dataplex-demo-380508/datasets/metadata_generation/tables/cc"
#print(wizard._get_table_profile(entry_id))
