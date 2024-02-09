from  google.cloud import datacatalog_v1
import json
from google.protobuf.json_format import MessageToJson
from google.cloud import dataplex_v1 #import lineage_v1
from google.cloud import datacatalog_lineage_v1 as lineage_v1
from google.cloud import bigquery


def lineage_source_tables(target_fqdn):
    # Create a client
    client = lineage_v1.LineageClient()
    target = lineage_v1.EntityReference()
    #source.fully_qualified_name = "bigquery:bigquery-public-data.ml_datasets.iris"
    target = lineage_v1.EntityReference()
    target.fully_qualified_name = target_fqdn

    # Initialize request argument(s)
    request = lineage_v1.SearchLinksRequest(
        parent="projects/446454295341/locations/us",
        target=target,
    )

    # Make the request
    page_result = client.search_links(request=request)

    # Handle the response
    for response in page_result:
        print(response)
        print(MessageToJson(response._pb))
    return MessageToJson(response._pb)


def _search_data_catalog(phrase):
    dc_client=datacatalog_v1.DataCatalogClient()
    project_id='jsk-dataplex-demo-380508'
    search_string = phrase
    scope = datacatalog_v1.types.SearchCatalogRequest.Scope()
    scope.include_project_ids.append(project_id)
    search_results = dc_client.search_catalog(scope=scope, query=search_string)

    results_list = []
    for result in search_results:
        result_dict = json.loads(MessageToJson(result._pb))
        result_dict['image_url'] = "https://lh3.googleusercontent.com/p9ST3mhfKqDdxwwgyGHCFmCddgFeHnYlQfCbORDHJm48z1cZhEknPXlbY_iGsnr2sIPk8EVanoqGjA=s48-w48-rw-lo" # Add the image_url to the dictionary
        results_list.append(result_dict)
        #results_list.append(result)

    return results_list

def _get_entry_details(entry_id):
     dc_client=datacatalog_v1.DataCatalogClient()
     request=datacatalog_v1.LookupEntryRequest(linked_resource = entry_id)
     results=dc_client.lookup_entry(request=request)
 #   entry = dc_client.lookup_entry(request={"linked_resource": entry_id})
 #   entry_dict = json.loads(MessageToJson(entry._pb))
     results_json = json.loads(MessageToJson(results._pb))
     

     return results_json



def _get_table_schema_bq(project_id, dataset_name, table_name):
    bqclient = bigquery.Client(project=project_id)
    """Get the schema of a table in BigQuery."""
    table = bqclient.get_table(f"{dataset_name}.{table_name}")
    return table.schema

def _bq_job_details(job_name):
    client = bigquery.Client
    location = "us"
    job_id = job_name#"bquxjob_35b0569c_18d59fa2d41"

    bqclient=bigquery.Client(project='jsk-dataplex-demo-380508')
 

    job = client.get_job(bqclient,job_id=job_id, location=location)

    # All job classes have "location" and "job_id" string properties.
    # Use these properties for job operations such as "cancel_job" and
    # "delete_job".
    print(f"{job.location}:{job.job_id}")
    print(f"Type: {job.job_type}")
    print(f"State: {job.state}")
    print(f"Created: {job.created.isoformat()}")
    print(f"Query: {job.query}")
    return job


def get_process_details (process_name):
    # Create a client
    client = lineage_v1.LineageClient()

    # Initialize request argument(s)
    request = lineage_v1.GetProcessRequest(
        name=process_name,
    )

    # Make the request
    response = client.get_process(request=request)
   # print(response)
    jsonized=json.loads(MessageToJson(response._pb))
    bq_sql=_bq_job_details(jsonized['attributes']['bigquery_job_id'])
    print(bq_sql.query)

    
   # if response.attributes[key=="bigquery_job_id":
   #     print(response.attributes.value.string_value)
    # Handle the response
   # print(response)
  #  print(MessageToJson(response._pb))
    return bq_sql



def lineage_source_tables(target_fqdn):
    # Create a client
    client = lineage_v1.LineageClient()
    target = lineage_v1.EntityReference()
    #source.fully_qualified_name = "bigquery:bigquery-public-data.ml_datasets.iris"
    target = lineage_v1.EntityReference()
    target.fully_qualified_name = target_fqdn

    # Initialize request argument(s)
    request = lineage_v1.SearchLinksRequest(
        parent="projects/446454295341/locations/us",
        target=target,
    )

    print('lineage_source_tables: looking for lineage links for table:'+target_fqdn)
    # Make the request
    page_result = client.search_links(request=request)
    response_list=[]
  
    # Handle the response
    for response in page_result:
        new_element={}
        new_element['name']=response.name
        new_element['source']=response.source.fully_qualified_name
        new_element['target']=response.target.fully_qualified_name
        print('lineage_source_tables: found lineage link:'+response.name)
        response_list.append(new_element)

   # print(json.loads(MessageToJson(page_result._pb)))
    return MessageToJson(page_result._pb)

def find_lineage_processes(target_table):
    #create a client
    client = lineage_v1.LineageClient()
    #client.batch_search_link_processes()
    #initialize request arguments
    print('find_lineage_processes: looking for lineage links for table:'+target_table)
    response=json.loads(lineage_source_tables(target_table))
    print('find_lineage_processes: response->'+json.dumps(response))
    links=[]
    for i in response['links']:
        links.append(i['name'])
        print('find_lineage looking for link:' + i['name'])
    request = lineage_v1.BatchSearchLinkProcessesRequest(parent="projects/446454295341/locations/us",links=links)
    #make the request

    page_result = client.batch_search_link_processes(request=request)
    return MessageToJson(page_result._pb)



def _get_single_data_scanname(tableref):
    dplx_client=dataplex_v1.DataScanServiceClient()
  
    response=dplx_client.list_data_scans(parent="projects/jsk-dataplex-demo-380508/locations/us-central1")
    #print(response)
    for element in response:
        print("START HERE---->\n"+str(element))
        
        print(element.data.resource)
        print("element resource name:"+element.data.resource)
        print("string position:"+str(str(element.data.resource).find(tableref)))
        if str(element.data.resource).find(tableref) > -1:
            
            print("FOUND at ->"+str(str(element.data.resource).find(tableref))+"\n element name:"+element.name)
            print("END HERE---->\n")
            return element.name
        else: 
            print("NOT FOUND in :"+str(element.data.resource))
        print("END HERE---->\n")
   # return "NOT FOUND"

def _get_table_profile(tablename):
        dplx_client=dataplex_v1.DataScanServiceClient()
  
        scanname=_get_single_data_scanname(tablename)


        requestscan=dataplex_v1.GetDataScanRequest(name=scanname)
        response_scan = dplx_client.get_data_scan(request=requestscan)
        # Set a GetDataScanRequest() using the args.datascan_name argument.

        dq_scan_name = response_scan.name
        jobs_request = dataplex_v1.ListDataScanJobsRequest(
                parent=scanname,
                page_size=10)
                # optional: filter, page_size

        page_result = dplx_client.list_data_scan_jobs(request=jobs_request)

        counter = 0
        job_names = []
        for response in page_result:
                counter += 1
                job_names.append(response.name)

        print('Jobs scanned: ' + str(counter))


        for job_name in job_names:
                job_request = dataplex_v1.GetDataScanJobRequest(
                        name=job_name,
                        view="FULL",
                )

                job_result = dplx_client.get_data_scan_job(request=job_request)
                        # Skips jobs if not in succeeded state
                if job_result.state != 4:
                        continue

                dq_job_id = job_result.uid

                print("dq_scan_name --> " + dq_scan_name)
                print("dq_job_id --> " + dq_job_id)
                print("job_result.data_quality_result.row_count --> " + str(job_result.data_quality_result.row_count))
                print("job_result.start_time --> " + str(job_result.start_time))
                print("job_result.end_time --> " + str(job_result.end_time))
                print("MessageToJson(job_result.data_profile_result.scanned_data._pb) --> " + MessageToJson(job_result.data_profile_result.scanned_data._pb))

                profile=MessageToJson(job_result.data_profile_result.profile._pb)
                return profile


def get_dependencies_info(tablename):
    processes=[]
    
    response=json.loads(find_lineage_processes(tablename))
    for i in response['processLinks']:

        print('get_dependencies_info:found process through lineage: '+i['process'])
        processes.append(i['process'])

    job_details=[]    
    for i in processes:
        result=get_process_details(i)
        print('get_dependencies_info:process details: '+result.query)
        job_details.append(result)
    
    #profile=_get_table_profile(tablename)

    return job_details



                

def _get_prompt(tablename,profile,sql_queries):
    contents="You are a data steward. Your role is to produce human meaningful metadata descriptions.\
    Table's fully qualified "+tablename+" \
    These SQL queries can be used to generate the data in table \
    "+ sql_queries+"\
    This is table profile information "+profile+"\
    Provide  description of table contents and usage. \
    Provide description of each column with top common values and their explanation. \
    Provide pseudocode expressed in SQL to calculate each field formatted in LaTeX.\
    "

    #get_dependencies_info('bigquery:jsk-dataplex-demo-380508.metadata_generation.cc')