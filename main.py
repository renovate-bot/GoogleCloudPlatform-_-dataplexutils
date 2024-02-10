from flask import Flask, request, render_template
from  metadata.metadata import _search_data_catalog,_get_entry_details,get_dependencies_info,_get_table_profile,generate_table_description


app = Flask(__name__)

@app.route('/', methods=['GET', 'POST'])
def home():
    if request.method == 'POST':
        search_query = request.form.get('search')
        results = _search_data_catalog(search_query)
        return render_template('results.html', results=results)
    return render_template('search.html')

@app.route('/details/', methods=['GET','POST'])
def details():
    entry_id = request.args.get('entry_id')
    another_parameter = request.args.get('another_parameter')
    result = _get_entry_details(entry_id)  # Replace this with your function to get a result by ID
    additional_info=get_dependencies_info(result['fullyQualifiedName'])
#    profile_info=_get_table_profile(result['fullyQualifiedName'])
    return render_template('details.html', result=result,details=additional_info,entry_id=entry_id)


@app.route('/generate/', methods=['GET','POST'])
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
                           profile_info=profile_info,generated_description=generated_description)
 


if __name__ == '__main__': 
    app.run(debug=True)