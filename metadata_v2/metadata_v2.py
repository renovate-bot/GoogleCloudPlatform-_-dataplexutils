from  google.cloud import datacatalog_v1
import json
from google.protobuf.json_format import MessageToJson
from google.cloud import dataplex_v1 #import lineage_v1
from google.cloud import datacatalog_lineage_v1 as lineage_v1
from google.cloud import datacatalog_v1beta1
from google.cloud import bigquery
import time
from vertexai.language_models import TextGenerationModel
from vertexai.preview.generative_models import (
    GenerationConfig,
    GenerativeModel,
    Image,
    Part,
)
import vertexai
from functools import lru_cache
from sql_formatter.core import format_sql

from flask import Flask, request, jsonify
import base64
from vertexai.preview.generative_models import GenerativeModel, Part
import vertexai.preview.generative_models as generative_models
from google.cloud import aiplatform
from pdf2image import convert_from_bytes
import io
from PIL import Image
import re


class MetadataWizardOptions:
    def __init__(self,use_pdf=False,use_profile=False,use_lineage=False,use_origin=False):
        self.use_pdf=use_pdf
        self.use_profile=use_profile
        self.use_lineage=use_lineage
        self.use_origin=use_origin

    use_pdf=False,
    use_profile=False,
    use_lineage=False,
    use_origin=False

class MetadataWizard:
    project_id=None
    region="us"
    dc_client=datacatalog_v1.DataCatalogClient()
    dc_policytagmanager_client=datacatalog_v1beta1.PolicyTagManagerClient()
    bqclient = None
    lineageclient=lineage_v1.LineageClient()
    dataplexscanservice_client=dataplex_v1.DataScanServiceClient()


    
    

    def get_datacatalog_client(self):
        return self.dc_client
    
    def get_politagmanager_client(self):
        return self.dc_policytagmanager_client
    
    def get_dataplexscanservice_client(self):
        return self.dataplexscanservice_client

    def __init__(self, name,project_id="jsk-dataplex-demo-380508"):
        self.name = name
        self.project_id = project_id
        self.bqclient=bigquery.Client(project=project_id)
        

    def _read_entryid(self,entry_id="//bigquery.googleapis.com/projects/jsk-dataplex-demo-380508/datasets/metadata_generation/tables/crimes"):

        pattern = r".*/tables/(.+)"  # Capture everything after the last '/'
        match = re.search(pattern, entry_id)

        if match:
            tablename = match.group(1)
            #print(tablename)  # Output: ccagg
            
        else:
            print("Table name not found") 
        pattern_ds = r".*/datasets/(.+)/tables"  # Capture everything after the last '/'
        match = re.search(pattern_ds, entry_id)

        if match:
            dataset = match.group(1)
            #print(tablename)  # Output: ccagg
            
        else:
            print("Dataset name not found")    

        pattern_pr = r".*/projects/(.+)/datasets"  # Capture everything after the last '/'
        match = re.search(pattern_pr, entry_id)

        if match:
            project = match.group(1)
            #print(tablename)  # Output: ccagg
            
        else:
            print("Project name not found")   
        return project,dataset,tablename

    def _read_fqdn(self,tablename="bigquery:jsk-dataplex-demo-380508.metadata_generation.ccagg"):


        pattern = r"^bigquery:([^.]+)\.([^.]+)\.([^.]+)" 
        match = re.search(pattern, tablename)

        if match:
            project = match.group(1)
            dataset = match.group(2)
            table = match.group(3)             
            return project,dataset,table
        else:
            return None,None,None

    def _read_tablename(self,tablename="jsk-dataplex-demo-380508.metadata_generation.ccagg"):


        pattern = r"^([^.]+)\.([^.]+)\.([^.]+)" 
        match = re.search(pattern, tablename)

        if match:
            project = match.group(1)
            dataset = match.group(2)
            table = match.group(3)             
            return project,dataset,table
        else:
            return None,None,None 


    def _read_columnname(self,tablename="jsk-dataplex-demo-380508.metadata_generation.ccagg.cuk"):


        pattern = r"^([^.]+)\.([^.]+)\.([^.]+)\.([^.]+)" 
        match = re.search(pattern, tablename)

        if match:
            project = match.group(1)
            dataset = match.group(2)
            table = match.group(3) 
            column = match.group(4)             
            return project,dataset,table,column
        else:
            return None,None,None,None

    @lru_cache(maxsize=32)
    def get_display_name(self,tag):
        
        dc_client=self.get_politagmanager_client() #datacatalog_v1beta1.PolicyTagManagerClient()
        request = datacatalog_v1beta1.GetPolicyTagRequest(name=tag.names[0])

        response = dc_client.get_policy_tag(request=request)

        def get_taxonomy_from_string(string):
            pattern = r"^(.+)/policyTags"
            match = re.search(pattern, string)
            if match:
                taxonomy_id = match.group(1)
                return taxonomy_id
            else:
                return None

        taxonomy_name=self.get_taxonomy_from_string(response.name)

        tax_request=datacatalog_v1beta1.GetTaxonomyRequest(name=taxonomy_name)
        response_taxonomy=dc_client.get_taxonomy(request=tax_request)
        return response_taxonomy.display_name+":"+response.display_name




    
    @lru_cache(maxsize=32)
    def _search_data_catalog(self,phrase):
        dc_client=self.get_datacatalog_client() #datacatalog_v1.DataCatalogClient()
        project_id=self.project_id
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

    @lru_cache(maxsize=32)
    def _get_entry_details(self,entry_id):
        dc_client=self.get_datacatalog_client() #datacatalog_v1.DataCatalogClient()
        request=datacatalog_v1.LookupEntryRequest(linked_resource = entry_id)
        results=dc_client.lookup_entry(request=request)
    #   entry = dc_client.lookup_entry(request={"linked_resource": entry_id})
    #   entry_dict = json.loads(MessageToJson(entry._pb))
        results_json = json.loads(MessageToJson(results._pb))
        

        return results_json

    def extract_metadata(self,entry_details,additional_info):

        try:
            dataplexOverview=entry_details['businessContext']['entryOverview']['overview']
        except:
            dataplexOverview=""

        try:
            bqOverview=entry_details['description']
        except:
            bqOverview=""
        
        
        combined_metadata={}

        combined_metadata['tablename']=entry_details
        combined_metadata['dataplex_description']=dataplexOverview
        combined_metadata['bq_description']=bqOverview
        return combined_metadata

    def get_lineageclient(self):
        return self.lineageclient
    
    def get_bq_client(self):

        return self.bqclient 

    @lru_cache(maxsize=32)
    def _get_table_bq(self,project_id, dataset_name, table_name):
        bqclient = self.get_bq_client() #bigquery.Client(project=project_id)
        """Get the schema of a table in BigQuery."""
        table = bqclient.get_table(f"{dataset_name}.{table_name}")
        return table

    @lru_cache(maxsize=32)
    def _get_table_schema_bq(self,project_id, dataset_name, table_name):
        bqclient = self.get_bq_client() # bigquery.Client(project=project_id)
        """Get the schema of a table in BigQuery."""
        table = bqclient.get_table(f"{project_id}.{dataset_name}.{table_name}")
        return table.schema

    @lru_cache(maxsize=32)
    def _bq_job_details(self,job_name):
        #client = bigquery.Client
        location = "us"
        job_id = job_name #"bquxjob_35b0569c_18d59fa2d41"

        client=self.get_bq_client() #bigquery.Client(project='jsk-dataplex-demo-380508')
    

        job = client.get_job(job_id=job_id, location=location)

        # All job classes have "location" and "job_id" string properties.
        # Use these properties for job operations such as "cancel_job" and
        # "delete_job".
        print(f"_bq_job_details: {job.location}:{job.job_id}")
        print(f"_bq_job_details: Type: {job.job_type}")
        print(f"_bq_job_details: State: {job.state}")
        print(f"_bq_job_details: Created: {job.created.isoformat()}")
       # print(f"_bq_job_details: Query: {job.query}")
        return job


    @lru_cache(maxsize=32)
    def get_process_details (self,process_name):
        # Create a client
        client = self.get_lineageclient() #lineage_v1.LineageClient()

        # Initialize request argument(s)
        request = lineage_v1.GetProcessRequest(
            name=process_name,
        )

        # Make the request
        response = client.get_process(request=request)
    # print(response)
        jsonized=json.loads(MessageToJson(response._pb))
        bq_sql=self._bq_job_details(jsonized['attributes']['bigquery_job_id'])
        print(bq_sql.query)

        
    # if response.attributes[key=="bigquery_job_id":
    #     print(response.attributes.value.string_value)
        # Handle the response
    # print(response)
    #  print(MessageToJson(response._pb))
        return bq_sql



    @lru_cache(maxsize=32)
    def lineage_source_tables(self,target_fqdn):
        # Create a client
        client = self.get_lineageclient()
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
    
    """ @lru_cache(maxsize=32)
    def lineage_source_tables(self,target_fqdn):
        # Create a client
        client = self.get_lineageclient()#lineage_v1.LineageClient()
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
        return MessageToJson(response._pb) """
    

    @lru_cache(maxsize=32)
    def find_lineage_processes(self,target_table):
        #create a client
        client = self.get_lineageclient() #lineage_v1.LineageClient()
        #client.batch_search_link_processes()
        #initialize request arguments
        print('find_lineage_processes: looking for lineage links for table:'+target_table)
        response=json.loads(self.lineage_source_tables(target_table))
        print('find_lineage_processes: response->'+json.dumps(response))
        links=[]

        for i in response['links']:
            links.append(i['name'])
            print('find_lineage looking for link:' + i['name'])
        request = lineage_v1.BatchSearchLinkProcessesRequest(parent=f"projects/{self.project_id}/locations/{self.region}",links=links)
        #make the request

        page_result = client.batch_search_link_processes(request=request)
        return MessageToJson(page_result._pb)

    @lru_cache(maxsize=32)
    def get_dependencies_info(self,tablename):
        processes=[]
        
        
        try:
            response = json.loads(self.find_lineage_processes(tablename))
        except Exception as e:
            print("Couldn't get lineage because:", str(e))
            response = None

        if response is not None:
            for i in response['processLinks']:

                print('get_dependencies_info:found process through lineage: '+i['process'])
                processes.append(i['process'])

            job_details=[]    
            for i in processes:
                result=self.get_process_details(i)
                #print('get_dependencies_info:process details: '+result.query)
                job_details.append(result)
        
        #profile=_get_table_profile(tablename)
        if response is None:
            return ""
        else:
            return job_details
        
    @lru_cache(maxsize=32)
    def _get_single_data_scanname(self,tableref):
        dplx_client=self.get_dataplexscanservice_client()#dataplex_v1.DataScanServiceClient()
    
        response=dplx_client.list_data_scans(parent="projects/jsk-dataplex-demo-380508/locations/us-central1")
        #print(response)
        for element in response:
          
            
            #print(element.data.resource)
            print("_get_single_data_scanname:element resource name:"+element.data.resource)
            print("_get_single_data_scanname:string position:"+str(str(element.data.resource).find(tableref)))
            print("_get_single_data_scanname:tableref:"+tableref)
            if str(element.data.resource).find(tableref) > -1:
                
                print("_get_single_data_scanname:FOUND at ->"+str(str(element.data.resource).find(tableref))+"\n element name:"+element.name)
              
                return element.name
            else: 
                print("_get_single_data_scanname:NOT FOUND in :"+str(element.data.resource))
            
    # return "NOT FOUND"


    @lru_cache(maxsize=32)
    def _get_table_profile(self,tablename):
            dplx_client=self.get_dataplexscanservice_client()#dataplex_v1.DataScanServiceClient()
            print('get_table_profile: looking for profile for table:'+tablename)
            scanname=self._get_single_data_scanname(tablename)


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




                    

    def _get_prompt(self,tablename,schema_str,profile,sql_queries,options=MetadataWizardOptions()):
        queries=""
        for i in sql_queries:
            queries=queries+i.query+";"
        print("_get_prompt:using configuration: lineage"+str(options.use_lineage)+\
              " profile:"+str(options.use_profile)+" origin:"+str(options.use_origin)+\
              " pdf:"+str(options.use_pdf))


        contents="You are a data steward. Your role is to produce human meaningful metadata descriptions of tables.\
        Table's fully qualified name "+tablename+". \
        This is table schema"+schema_str+"."
        
        if options.use_lineage:
            contents+=" These SQL queries can be used to generate the data in table "+ queries +"."
            print("_get_prompt:use_lineage is true")

        if options.use_profile:
            contents+=" This is table profile information "+profile+"."  
            print("_get_prompt:use_profile is true")  

        #if options.use_origin==True:

        contents+="Task for today is: \
        Provide two part description of a table - first paragraph starting with **Description** is describing contents and purpose of the table. It describes table contents, business area and how the table can be used. It does not describe each column but generalizes table contents. \
        Second paragraph starting with **Source** provides information how is that table is calculated from originating tables, mentiones level of aggregation, Which tables are joined, What data is filterd,  what are most sifgnificant data transformations. If there's no lineage information then second paragraph is ommited\
        do not use markdown, or do not the keywords like 'sql' at the beginning of answer, do not use ``` to enclose the response\
        "
        return contents

    def _get_prompt_column(self,column,tablename,schema_str,profile,sql_queries,options=MetadataWizardOptions()):
        queries=""
        for i in sql_queries:
            queries=queries+i.query+";"

        contents="You are a data expert. Your role is to be a data steward. Your task is to produce human meaningful metadata \
        descriptions with business interpretation of table.\
        Table's fully qualified name:"+tablename+". \
        This is table schema"+schema_str+"."

        if options.use_lineage:
            contents+=" These SQL queries are used to generate the data in table "+ queries+"."

        if options.use_profile:
            contents+=" This is table profile information "+profile+"."    

        contents+="Task for today is: \
        Please provide max 50words long description of column:"+column+" \
        Examples of descriptions: \
        'The cn column in the table cc represents the case number. It is a unique identifier for each row in the table. The case number is a string that is typically 9 characters long. The first two characters of the case number indicate the year in which the case was filed. The next two characters indicate the month in which the case was filed. The next two characters indicate the day of the month in which the case was filed. The last three characters of the case number are a sequential number.'\
        "
        return contents

    def _get_prompt_column_formula(self,column,tablename,schema_str,profile,sql_queries):
        queries=""
        for i in sql_queries:
            queries=queries+i.query+";"

        contents="You are a data expert. Your role is to be a data steward. Your task is to produce human meaningful metadata \
        descriptions with business interpretation of table.\
        Table's fully qualified name:"+tablename+". \
        This is table schema"+schema_str+".\
        These SQL queries are used to generate the data in table \
        "+ queries +"\
        This is table profile information "+profile+"\
        Task for today is: \
        Please provide SQL snippet that produces column "+column+" \
        do not use markdown, or do not the keyword 'sql' at the beginning, do not use ``` to enclose the code.\
        examples:\
        select count(distinct unique_key) cuk from `bigquery-public-data.chicago_crime.crime`\
        select extract(day from date) as d from `bigquery-public-data.chicago_crime.crime`\
            "
        return contents




    def _get_prompt_column_lineage(self,column,tablename,schema,sql_queries):
        queries=""
        for i in sql_queries:
            queries=queries+i.query+";"

        schema_str="{"
        for field in schema:
            schema_str+=field.name+":"+field.field_type+","
        
        schema_str+="}"


        contents='''You are an data expert very skilled on SQL understanding. \
        This is are SQLs  used to load into table '''+tablename+''' with schema '''+schema_str+''' .\
        SQLs:'''+ queries +'''\
        The source table `bigquery-public-data.chicago_crime.crime` has schema schema '''+schema_str+''' .\
        The source table `jsk-dataplex-demo380508.metadata_generation.crime` has schema schema '''+schema_str+''' 
        Please provide information how is the field '''+column+''' calculated by showing which source column data comes from. There may be more than one column if there's a complex formula or multiple queries. \
        Return results as a json in format {"columns":["project_name.table_name.column_name"]}\
        do not use no markdown, or do not use the keyword "sql" or "json" at the beginning and do not use ``` to enclose the code or you will be terminated\
        example: \
            {"columns":["projectz.tabley.columnx","project.table.column2"]}\
            {"columns":["jsk-dataplex-380508.metadata_generation.ccagg"]}\
            {"columns":[]}\
            '''
        print(contents)

        return contents

    def generate_column_lineage(self,column,tablename,profile,sql_queries):
        #return '''"{"columns":[,"jsk-dataplex-demo-380508.metadata_generation.crimes.unique_key","","bigquery-public-data.chicago_crime.crime.unique_key","bigquery-public-data.chicago_crime.crime.unique_key",""]}"'''
        project,dataset,table=self._read_fqdn(tablename)
        returned_text=''
        unverified_text=''

        for query in sql_queries:

            #first query bison to find for source tables
            tables='''{"tables":['''
            tables+=self.call_bison('''You are an SQL expert. This is a sql for analysis:'''+query.query+'''. provide source table used to load the data in table '''+tablename+'''\
            example: "project_name.dataset_name.table_name","another_project.some_dataset_name.other_table_name"\
            example: "project_name.dataset_name.table_name","another_project.some_dataset_name.other_table_name","anothe123r_project.so12me_dataset_name.othe32r_table_name"\
            example: "anothe_project.so12me_dataset_name.othe_tabl_name"\
            In response do not use markdown, do not use the keyword "sql" or "json" at the beginning and do not use ``` to enclose the code or you will be terminated. You must use doublequotes "" to enclose the table names.''')
            tables+=']}'
            print("generate_column_lineage -> found these tables"+tables)
            tables_json=json.loads(tables)
            
            tables_schema="source tables schema:"
            for i in tables_json["tables"]:
                #now  schema of source tables
                proj,data,tab=self._read_tablename(i)
                
                schema=self._get_table_schema_bq(proj,data,tab)
                schema_str=i+"{"
                for field in schema:
                    schema_str+=field.name+":"+field.field_type+","
                schema_str+="}"
                tables_schema+=schema_str
            #now we have source tables and their schema
            
            target_table_schema=self._get_table_schema_bq(project,dataset,table)
            target_table_schema_str=tablename+"{"
            for field in schema:
                target_table_schema_str+=field.name+":"+field.field_type+","
            target_table_schema_str+="}"
            
            rewrite_queryprompt='''This is my query: '''+query.query+'''. \
                If the query uses select * notation please then rewrite it to explicitly use column names from the source tables that query uses in the order the tables are listed in from clause. \
                Additional information: \
                * This is source schema of tables: '''+tables_schema+'''\
                * This is the schema of the target table that query writes to '''+tablename+''': '''+target_table_schema_str+'''.\
                if the select statement is not using * then return the query as is.'''
            print("* * * rewrite_queryprompt:"+rewrite_queryprompt)
            #rewritten_query=call_gemini(rewrite_queryprompt)
            rewritten_query=query.query
            print("\nI rewritten query to be:"+rewritten_query)
            #next we need to find lineage of a column
            contents='''You are a data expert very skilled in SQL understanding. I need your help to trace data lineage. Here's the information: \
            Target table: '''+tablename+''' 
            Target schema: '''+target_table_schema_str+''' .\
            Target column: '''+column+'''\
            SQL query:'''+rewritten_query  +'''. 
            Source table schema: '''+schema_str+''' \
            Task:\
            **Scrutinize Source Columns:**  Carefully examine the source tables schema '''+schema_str+'''. Search for the following clues: \
            * **Data Type Compatibility:** Consider the data type of the target column (if available) to narrow down potential source columns to those with compatible data types. \
            * **Aliases:**  Be aware of potential aliases created in the query, but since `SELECT *` is used, this is less likely.
            * ** Mapping:  If you find a likely source column (or columns for calculation), return the result as a string in the format: "project_name.table_name.column_name". Use double quotes.\
            * ** implicit Aliases:**  sometimes instead of syntax 'FIELDNAME as ALIAS' queries use 'FIELDNAME ALIAS' syntax so you must retrieve the FIELDNAME if column '''+column+''' origins from it.\
            No Match: If you are unable to find any suitable source for '''+column+''', return an empty string: ""\
            Important Notes:\
            Knowing the data type of '''+column+''' in the target table would further refine the search. \
            Complex SQL transformations might necessitate deeper analysis than a simple column name search.\
            extremely important If you are unable to find a source column then return empty string.\
            extremely important - Only acceptable output is the source column name in the format: "project_name.table_name.column_name".\
            example output:"projectz.tabley.columnx","project.table.column2"\
            example output:"jsk-dataplex-380508.metadata_generation.ccagg"\
            example output:"bigquery-public-data.chicago_crime.crime.unique_key"\
            example output:""\
                '''
            values=""
            print("Prompt for lineage:"+contents)

            

            #returned_text+=call_bison(contents)+","
            unverified_text=self.call_gemini(contents)
            print("Unverified lineage:"+unverified_text)
            
            check_for_alias_prompt='''You are a data expert very skilled in SQL understanding. I need your verify if columns listed \
                in the json  '''+unverified_text+''' exist in original schema. \
                if the columns are just aliases, please correct the json to refer to actual columns from source schema \
                Here is the information: \
                Target table: '''+tablename+''' 
                Target table schema: '''+target_table_schema_str+''' .\
                SQL query that may contain the aliases :'''+rewritten_query  +''' \
                Source table schema: '''+schema_str+''' \
                If the json refers to an alias defined in a query then replace alias with name of the original column from Source schema. \
                If the json refers to actual column from schema then keep it unchanged.\
                return the results in the same format as the input \
                '''
            
            #returned_text += call_gemini(check_for_alias_prompt)+","
            returned_text+=unverified_text+","
            print("Verified lineage:"+returned_text)

        
        print("_get_prompt_column_lineage:this is generated returned_text:"+returned_text)
        print("_get_prompt_column_lineage:generated description")
        def deduplicate_string(string):
            values = string.split(',')

            # Remove empty strings and duplicates
            values = list(set(filter(lambda x: x != '""' and x != '', values)))

            # Join the values back into a string
            result = ','.join(values)
            if result.startswith(','):
                result = result[1:]
            return result
            
        deduplicated_string = '''{"columns":['''+deduplicate_string(returned_text)+''']}'''

        return deduplicated_string
        






    def _get_prompt_column_suggested_terms(self,column,tablename,profile,sql_queries,glossary):
        queries=""
        for i in sql_queries:
            queries=queries+i.query+";"

        contents='''You are a data steward and expert on data processing and SQL. \
        Your role is to be a data steward and suggest the right glossary terms from available terms to match the table and column description\
        Table's fully qualified name:'''+tablename+''' \
        These SQL queries are used to generate the data in table \
        '''+ queries +'''\
        This is table profile information '''+profile+'''\
        These are the only available glossary terms:'''+glossary+'''\
        do not use markdown, or do not the keyword 'sql' at the beginning, do not use ``` to enclose the code.\
        You must only use the terms from available glossary terms. If none of the terms is a good fit return empty list\
        Your task for today is to suggested the terms for column:'''+column+''' from the available list and return it as json.\
        examples:\
            {"terms":["FBI Code","District","Beat"]}\
            {"terms":["Incident Date"]}\
            {"terms":["Geo Coordinates"]}\
            {"terms":["Community Area","District"]}\
            {"terms":["Trip types"]}\
            {"terms":[]}\
        '''
        return contents

    @lru_cache(maxsize=64)
    def call_bison(self,prompt,temperature=0.9,project_id="jsk-dataplex-demo-380508",location="us-central1"):
        vertexai.init(project=project_id, location=location)

        parameters = {
            "temperature": temperature,  # Temperature controls the degree of randomness in token selection.
            "max_output_tokens": 256,  # Token limit determines the maximum amount of text output.
            "top_p": 0.8,  # Tokens are selected from most probable to least until the sum of their probabilities equals the top_p value.
            "top_k": 40,  # A top_k of 1 means the selected token is the most probable among all tokens.
        }

        model = TextGenerationModel.from_pretrained("text-unicorn@001")
        response = model.predict(
            prompt,
            **parameters,
        )
        print(f"Response from Model: {response.text}")

        return response.text

    @lru_cache(maxsize=32)
    def call_gemini(self,prompt,temperature=0.9,project_id="jsk-dataplex-demo-380508",location="us-central1"):
        
        text_model= GenerativeModel("gemini-1.5-flash-preview-0514")
        text_model.generate_content(prompt)
        returned_text=""
        generated_description = text_model.generate_content(prompt)
        for i in generated_description.candidates:

            for j in i.content.parts:
                returned_text+=j.text
        return returned_text



    def generate_table_description(self,tablename,profile,sql_queries,pdf,options):

        project,dataset,table=self._read_fqdn(tablename)
        
        schema=self._get_table_schema_bq(project, dataset, table)

        schema_str=""
        for field in schema:
            schema_str+=field.name+":"+field.field_type+","
    
        print("generate_table_description:generating with options: use_pdf:"+str(options.use_pdf)+"profile:"+str(options.use_profile)+"lineage:"\
              +str(options.use_lineage)+"profile:"+str(options.use_profile))
        
        prompt=self._get_prompt(tablename,schema_str,profile,sql_queries,options)
        # Save prompt as JSON file
      #  with open('prompt.json', 'w') as file:
      #      json.dump(prompt, file)


        if prompt is None:
            return "ERROR generating description - Prompt is None"
        

        text_model= GenerativeModel("gemini-pro")
        print("generate_table_description:accessing llm")
        if pdf is not None:
            #not sending profile to vision because it is too large
            prompt=self._get_prompt(tablename,schema_str,profile,sql_queries)
            returned_text=self.call_vision_gemini(pdf,prompt)
            
        else:
            generated_description = text_model.generate_content(prompt)
            returned_text=""
            
            for i in generated_description.candidates:

                for j in i.content.parts:
                    returned_text+=j.text
        print("generate_table_description:generated description")
        return returned_text

    def generate_column_description(self,tablename,column,profile,sql_queries,options):

        project,dataset,table=self._read_fqdn(tablename)      
        schema=self._get_table_schema_bq(project, dataset, table)
        schema_str=""
        for field in schema:
            schema_str+=field.name+":"+field.field_type+","

        prompt=self._get_prompt_column(column,tablename,schema_str,profile,sql_queries,options)
        


        text_model= GenerativeModel("gemini-pro")
        print("generate_column_description:"+column+" table " +tablename+" -> accessing llm")
        generated_description = text_model.generate_content(prompt)
        returned_text=""
        
        for i in generated_description.candidates:

            for j in i.content.parts:
                returned_text+=j.text
        print("generate_column_description:"+column+" table " +tablename+" -> generated description")
        return returned_text    


    def generate_column_formula(self,tablename,column,profile,sql_queries):
        project,dataset,table=self._read_fqdn(tablename)
        
        schema=self._get_table_schema_bq(project, dataset, table)

        schema_str=""
        for field in schema:
            schema_str+=field.name+":"+field.field_type+","
        prompt=self._get_prompt_column_formula(column,tablename,schema_str,profile,sql_queries)
        
        text_model= GenerativeModel("gemini-pro")
        print("generate_column_formula:"+column+" table " +tablename+" -> accessing llm")
        generated_description = text_model.generate_content(prompt)
        returned_text=""
        
        for i in generated_description.candidates:
            for j in i.content.parts:
                returned_text+=j.text
        print("generate_column_formula:"+column+" table " +tablename+" -> generated formula")
        return returned_text 

    def suggest_column_glossary_terms(self,column,tablename,profile,sql_queries,glossary_name):
        
        glossary=self._get_full_glossary(glossary_name)
        glossary_string=json.dumps(glossary)

        prompt=self._get_prompt_column_suggested_terms(column,tablename,profile,sql_queries,glossary_string)
        
        text_model= GenerativeModel("gemini-pro")
        print("generate_suggested_terms:"+column+" table " +tablename+" -> accessing llm")
        generated_description = text_model.generate_content(prompt)
        returned_text=""
        
        for i in generated_description.candidates:
            for j in i.content.parts:
                returned_text+=j.text
        print("generate_suggested_terms:"+column+" table " +tablename+" -> generated formula")
        print("generate_suggested_terms:"+column+" table " +tablename+" -> generated these terms ->"+returned_text)
        return returned_text 

    def _get_full_glossary(self,glossary_name):
        #dummy function i make up the glossary until API starts to work

        glossary_terms = [
            {
                "term": "Incident Type",
                "description": "The primary classification of the crime as defined by the Chicago Police Department (e.g., 'THEFT', 'BATTERY', 'HOMICIDE')"
            },
            {
                "term": "Incident Category",
                "description": "A broader grouping of the crime type (e.g., 'Property Crime', 'Violent Crime', 'Criminal Sexual Assault')"
            },
            {
                "term": "Arrest",
                "description": "Whether an arrest was made in connection with the incident (Boolean: 'true' or 'false')"
            },
            {
                "term": "Domestic",
                "description": "Whether the crime involved a domestic relationship between the victim and offender (Boolean: 'true' or 'false')"
            },
            {
                "term": "Beat",
                "description": "The police beat number where the crime occurred. Beats are smaller divisions within police districts."
            },
            {
                "term": "District",
                "description": "The police district number where the crime occurred."
            },
            {
                "term": "Community Area",
                "description": "The designated community area (out of 77) where the crime took place. Provides broader geographic context than beat or district."
            },
            {
                "term": "Ward",
                "description": "The political ward (out of 50) where the crime occurred."
            },
            { 
                "term": "Date",
                "description": "The full date of the crime's occurrence (format: YYYY-MM-DD)"
            },
            {
                "term": "Time",
                "description": "The time of day the crime occurred (format: HH:MM:SS)"
            }
        ]
        return glossary_terms

    #get_dependencies_info('bigquery:jsk-dataplex-demo-380508.metadata_generation.cc')
    #3profil=_get_table_profile('//bigquery.googleapis.com/projects/jsk-dataplex-demo-380508/datasets/metadata_generation/tables/ccagg')
    #print(profil)
    #_get_table_profile('bigquery:jsk-dataplex-demo-380508.metadata_generation.ccagg')
    #_get_single_data_scanname("//bigquery.googleapis.com/projects/jsk-dataplex-demo-380508/datasets/metadata_generation/tables/ccagg")

    def pdf_to_images(self,base64_pdf):
        # Decode the base64 PDF
        pdf_bytes = base64.b64decode(base64_pdf)
        # Convert PDF to a list of images
        images = self.convert_from_bytes(pdf_bytes)
        # Convert images to base64
        base64_images = []
        for image in images:
            img_byte_arr = io.BytesIO()
            image.save(img_byte_arr, format='JPEG')  # You can choose JPEG or PNG depending on your needs
            img_byte_arr = img_byte_arr.getvalue()
            base64_encoded = base64.b64encode(img_byte_arr).decode('utf-8')
            base64_images.append(base64_encoded)
        return base64_images

    def combine_images(self,base64_images):
        images = [Image.open(io.BytesIO(base64.b64decode(img))) for img in base64_images]
        
        # Calculate the total height and the maximum width of the combined image
        total_height = sum(image.height for image in images)
        max_width = max(image.width for image in images)
        
        # Create a new image with the appropriate height and width
        combined_image = Image.new('RGB', (max_width, total_height))
        
        # Paste each image into the combined image
        y_offset = 0
        for image in images:
            combined_image.paste(image, (0, y_offset))
            y_offset += image.height
        
        # Convert the combined image back to base64
        img_byte_arr = io.BytesIO()
        combined_image.save(img_byte_arr, format='JPEG')  # Change to 'PNG' if preferred
        img_byte_arr = img_byte_arr.getvalue()
        base64_combined_image = base64.b64encode(img_byte_arr).decode('utf-8')
        
        return base64_combined_image



    def call_vision_gemini(self,base64_image,text_prompt):
        # Initialize the model
        model_name="gemini-1.5-pro-preview-0409" #"gemini-pro-vision"
        model = GenerativeModel(model_name)
        
        # Decode the base64-encoded image to get raw image data
        image_data = base64.b64decode(base64_image)
        
        

        # Create a part for the image using its raw data
        image_part = Part.from_data(data=image_data, mime_type="image/jpeg")  # Ensure this matches the format you saved (JPEG or PNG)
        text_part = Part.from_text("attached file consists of important documentation to the data and here is the main task:"+text_prompt)

        print("call_vision_gemini:accessing llm:Prompt length "+str(len(text_prompt))) 
        response_texts=""
        # Generate content based on the image
        responses = model.generate_content(
            [text_part,image_part],
            generation_config={
                "max_output_tokens": 2048,
                "temperature": 0.6,
                "top_p": 1,
                "top_k": 32
            },
            safety_settings={
                generative_models.HarmCategory.HARM_CATEGORY_HATE_SPEECH: generative_models.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                generative_models.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: generative_models.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                generative_models.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: generative_models.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
                generative_models.HarmCategory.HARM_CATEGORY_HARASSMENT: generative_models.HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
            stream=True,
        )
        
        # Collect responses
        for response in responses:
            response_texts += response.text 
        
        return response_texts
        #response_texts = [response.text for response in responses]
        
        # Return the collected responses
        #return response_texts



    def _read_entryid(entry_id="//bigquery.googleapis.com/projects/jsk-dataplex-demo-380508/datasets/metadata_generation/tables/ccagg"):

        pattern = r".*/tables/(.+)"  # Capture everything after the last '/'
        match = re.search(pattern, entry_id)

        if match:
            tablename = match.group(1)
            #print(tablename)  # Output: ccagg
            
        else:
            print("Table name not found") 
        pattern_ds = r".*/datasets/(.+)/tables"  # Capture everything after the last '/'
        match = re.search(pattern_ds, entry_id)

        if match:
            dataset = match.group(1)
            #print(tablename)  # Output: ccagg
            
        else:
            print("Dataset name not found")    

        pattern_pr = r".*/projects/(.+)/datasets"  # Capture everything after the last '/'
        match = re.search(pattern_pr, entry_id)

        if match:
            project = match.group(1)
            #print(tablename)  # Output: ccagg
            
        else:
            print("Project name not found")   
        return project,dataset,tablename


    @lru_cache(maxsize=32)
    def get_display_name(self,tag):
        dc_client=self.get_politagmanager_client()# datacatalog_v1beta1.PolicyTagManagerClient()
        request = datacatalog_v1beta1.GetPolicyTagRequest(name=tag.names[0])

        response = dc_client.get_policy_tag(request=request)

        def get_taxonomy_from_string(string):
            pattern = r"^(.+)/policyTags"
            match = re.search(pattern, string)
            if match:
                taxonomy_id = match.group(1)
                return taxonomy_id
            else:
                return None

        taxonomy_name=get_taxonomy_from_string(response.name)

        tax_request=datacatalog_v1beta1.GetTaxonomyRequest(name=taxonomy_name)
        response_taxonomy=dc_client.get_taxonomy(request=tax_request)
        return response_taxonomy.display_name+":"+response.display_name

    @lru_cache(maxsize=32)
    def get_policy_tags_for_columns(self,column_id='''{"columns":["bigquery-public-data.chicago_crime.crime.date","jsk-dataplex-demo-380508.metadata_generation.crimes.unique_key"]}'''):
        col_vals = json.loads(column_id)['columns']
        string=''

        for i in col_vals:
            proj,dataset,table,column=self._read_columnname(i)
            print(self._read_columnname(i))
            table=self._get_table_bq(proj,dataset,table)
            for col in table.schema:
                if(col.name==column):
                    if col.policy_tags != None:
                        if string != '':
                            string+=','
                        string+='''{"column":"'''+i+'''","tag_name":"'''+self.get_display_name(col.policy_tags)+'"}'''
        
        print("get_policy_tags_for_columns->"  +string)  
        
        return string
                
        def deduplicate_string(string):
            values = string.split(',')

            # Remove empty strings and duplicates
            values = list(set(filter(lambda x: x != '""' and x != '', values)))

            # Join the values back into a string
            result = ','.join(values)
            if result.startswith(','):
                result = result[1:]
            return result
            
        deduplicated_string = '''{"tags":['''+deduplicate_string(string)+''']}'''
        return deduplicated_string
                        
                

                    
                    
        
