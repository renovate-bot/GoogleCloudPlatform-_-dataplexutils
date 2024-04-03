from flask import Flask, request, render_template, jsonify
from  metadata.metadata import get_policy_tags_for_columns,generate_column_lineage,suggest_column_glossary_terms,pdf_to_images,combine_images,generate_column_formula,extract_metadata,generate_column_description,_search_data_catalog,_get_entry_details,get_dependencies_info,_get_table_profile,generate_table_description
from flask_caching import Cache

#from pdf_ai_flask.pdf import pdf_to_images,combine_images,query_gemini
import base64
import io
from PIL import Image



app = Flask(__name__)
# Basic configuration
config = {
    "CACHE_TYPE": "simple",  #  Use simple in-memory cache for simplicity
    "CACHE_DEFAULT_TIMEOUT": 1  # Default 5 minute expiration
}
app.config.from_mapping(config)

cache = Cache(app)

# Global dictionary available to all methods
global_dict = {}





@app.route('/', methods=['GET', 'POST'])
def home():
    if request.method == 'POST':
        search_query = request.form.get('search')
        results = _search_data_catalog(search_query)
        return render_template('results.html', results=results)
    return render_template('search.html')

@app.route('/details/', methods=['GET','POST'])
#@cache.cached(timeout=300) 
def details():
    entry_id = request.args.get('entry_id')
    another_parameter = request.args.get('another_parameter')
    result = _get_entry_details(entry_id)  # Replace this with your function to get a result by ID
    additional_info=get_dependencies_info(result['fullyQualifiedName'])
#    profile_info=_get_table_profile(result['fullyQualifiedName'])
    table_metadata=extract_metadata(result,additional_info)
    return render_template('details.html', result=result,details=additional_info,entry_id=entry_id,table_metadata=table_metadata)


@app.route('/generate/', methods=['GET','POST'])
@cache.cached(timeout=30) 
def generate():
    entry_id = request.args.get('entry_id')
    another_parameter = request.args.get('another_parameter')
    result = _get_entry_details(entry_id)  # Replace this with your function to get a result by ID
    print("generate():result['fullyQualifiedName']:",result['fullyQualifiedName'])
    additional_info=get_dependencies_info(result['fullyQualifiedName'])
    profile_info=_get_table_profile(entry_id)

    generated_description=generate_table_description(tablename=result['fullyQualifiedName'],profile=profile_info,\
                                                     sql_queries=additional_info)

    return render_template('generate.html', result=result,details=additional_info,\
                           profile_info=profile_info,generated_description=generated_description,entry_id=entry_id)

@app.route('/generateTableDescription/', methods=['GET','POST'])
def generateTableDescription():
    entry_id = request.args.get('entry_id')
    result = _get_entry_details(entry_id)  # Replace this with your function to get a result by ID
    print("generate():result['fullyQualifiedName']:",result['fullyQualifiedName'])
    additional_info=get_dependencies_info(result['fullyQualifiedName'])
    profile_info=_get_table_profile(entry_id)
    generated_description=generate_table_description(tablename=result['fullyQualifiedName'],profile=profile_info,\
                                                    sql_queries=additional_info,pdf=global_dict.popitem()[1] if global_dict else None)

    return generated_description

@app.route('/generateColumnSuggestedTerms/', methods=['GET','POST'])
def generateColumnSuggestedTerms():
    entry_id = request.args.get('entry_id')
    column_name = request.args.get('column')
    column_desc = request.args.get('coluumn_desc')
    result = _get_entry_details(entry_id)  # Replace this with your function to get a result by ID
    print("generate():result['fullyQualifiedName']:",result['fullyQualifiedName'])
    additional_info=get_dependencies_info(result['fullyQualifiedName'])
    profile_info=_get_table_profile(entry_id)
    generated_terms=suggest_column_glossary_terms(column_name,tablename=result['fullyQualifiedName'],profile=profile_info,\
                                                     sql_queries=additional_info,glossary_name='dummy_name')

    return generated_terms
 
@app.route('/generateColumnDescription/', methods=['GET','POST'])
def generateColumnDescription():
    entry_id = request.args.get('entry_id')
    column_name = request.args.get('column')
    
    print("generateColumnDescription():entry_id:",entry_id)
    print("generateColumnDescription():column:",column_name)
    result = _get_entry_details(entry_id)  # Replace this with your function to get a result by ID
    print("generate():result['fullyQualifiedName']:",result['fullyQualifiedName'])
    additional_info=get_dependencies_info(result['fullyQualifiedName'])
    profile_info=_get_table_profile(entry_id)
    generated_description=generate_column_description(tablename=result['fullyQualifiedName'],column=column_name,profile=profile_info,\
                                                     sql_queries=additional_info)
    return generated_description
 
@app.route('/generateColumnFormula/', methods=['GET','POST'])
def generateColumnFormula():
    entry_id = request.args.get('entry_id')
    column_name = request.args.get('column')
    print("generateColumnFormula():entry_id:",entry_id)
    print("generateColumnFormula():column:",column_name)
    result = _get_entry_details(entry_id)  # Replace this with your function to get a result by ID
    print("generate():result['fullyQualifiedName']:",result['fullyQualifiedName'])
    additional_info=get_dependencies_info(result['fullyQualifiedName'])
    profile_info=_get_table_profile(entry_id)
    generated_formula=generate_column_formula(tablename=result['fullyQualifiedName'],column=column_name,profile=profile_info,\
                                                     sql_queries=additional_info)
    return generated_formula

@app.route('/generateColumnLineage/', methods=['GET','POST'])
def generateColumnLineage():
    entry_id = request.args.get('entry_id')
    column_name = request.args.get('column')
    print("generateColumnLineage():entry_id:",entry_id)
    print("generateColumnLineage():column:",column_name)
    result = _get_entry_details(entry_id)  # Replace this with your function to get a result by ID
    print("generate():result['fullyQualifiedName']:",result['fullyQualifiedName'])
    additional_info=get_dependencies_info(result['fullyQualifiedName'])
    profile_info=_get_table_profile(entry_id)
    generated_lineage=generate_column_lineage(column=column_name,tablename=result['fullyQualifiedName'],profile=profile_info,\
                                                     sql_queries=additional_info)
    return generated_lineage
 
@app.route('/getProfile/', methods=['GET','POST'])
def getProfile():
    entry_id = request.args.get('entry_id')
    profile_info=_get_table_profile(entry_id)
    return profile_info

@app.route('/getPolicyTags/', methods=['GET','POST'])
def getPolicyTags():
    column_id = request.args.get('column')
    build_json=get_policy_tags_for_columns(column_id)
    return build_json


@app.route('/pdf', methods=['GET', 'POST'])
def upload_file():
    if request.method == 'POST':
        if 'file' not in request.files:
            return 'No file part'
        file = request.files['file']
        if file.filename == '':
            return 'No selected file'
        if file and file.filename.endswith('.pdf'):
            pdf_content = file.read()
            base64_images = pdf_to_images(base64.b64encode(pdf_content).decode('utf-8'))
            
            # Combine images into one
            base64_combined_image = combine_images(base64_images)
            global_dict[file.filename] = base64_combined_image
            return "Loaded succesfully"
            # Process the combined image with Gemini
     #       response = query_gemini(base64_combined_image)
    #        
    #        # Return the Gemini response
   
    #    else:
    #        return 'Invalid file format. Please upload a PDF file.'
        

if __name__ == '__main__': 
    app.run(debug=True)