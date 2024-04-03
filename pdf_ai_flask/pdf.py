from flask import Flask, request, jsonify
import base64
from vertexai.preview.generative_models import GenerativeModel, Part
import vertexai.preview.generative_models as generative_models
from google.cloud import aiplatform
from pdf2image import convert_from_bytes
import io
from PIL import Image


app = Flask(__name__)
aiplatform.init(project='jsk-dataplex-demo-380508', location='us-central1')

def pdf_to_images(base64_pdf):
    # Decode the base64 PDF
    pdf_bytes = base64.b64decode(base64_pdf)
    # Convert PDF to a list of images
    images = convert_from_bytes(pdf_bytes)
    # Convert images to base64
    base64_images = []
    for image in images:
        img_byte_arr = io.BytesIO()
        image.save(img_byte_arr, format='JPEG')  # You can choose JPEG or PNG depending on your needs
        img_byte_arr = img_byte_arr.getvalue()
        base64_encoded = base64.b64encode(img_byte_arr).decode('utf-8')
        base64_images.append(base64_encoded)
    return base64_images

def combine_images(base64_images):
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



def query_gemini(base64_image):
    # Initialize the model
    model = GenerativeModel("gemini-pro-vision")
    
    # Decode the base64-encoded image to get raw image data
    image_data = base64.b64decode(base64_image)
    
    # Create a part for the image using its raw data
    image_part = Part.from_data(data=image_data, mime_type="image/jpeg")  # Ensure this matches the format you saved (JPEG or PNG)
    
    # Generate content based on the image
    responses = model.generate_content(
        #[ "Interpret this document. If detected, report back the table schema and some sample queries. Structure your answer in JSON format",image_part],
        [ "Interpret this document",image_part],
        generation_config={
            "max_output_tokens": 2048,
            "temperature": 0.4,
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
    response_texts = [response.text for response in responses]
    
    # Return the collected responses
    return response_texts


@app.route('/', methods=['GET', 'POST'])
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
            
            # Process the combined image with Gemini
            response = query_gemini(base64_combined_image)
            
            # Return the Gemini response
            return jsonify({"response": response})
        else:
            return 'Invalid file format. Please upload a PDF file.'


    return '''
    <!doctype html>
    <title>Upload PDF</title>
    <h1>Upload PDF File</h1>
    <form method=post enctype=multipart/form-data>
      <input type=file name=file>
      <input type=submit value=Upload>
    </form>
    '''

if __name__ == '__main__':
    app.run(debug=True)
