PROJECT_ID = "cloud-llm-preview1"  # @param {type:"string"}
LOCATION = "us-central1"  # @param {type:"string"}

# Initialize Vertex AI
import vertexai

vertexai.init(project=PROJECT_ID, location=LOCATION)

import time
from vertexai.preview.generative_models import (
    GenerationConfig,
    GenerativeModel,
    Image,
    Part,
)

multimodal_model = GenerativeModel("gemini-ultra-vision")
text_model= GenerativeModel("gemini-pro")

contents="how much wood would a woodchuck chuck if a woodchuck could chuck wood?"

responses = text_model.generate_content(contents)

print("\n-------Response--------")
for response in responses:
    print(response.text, end="")