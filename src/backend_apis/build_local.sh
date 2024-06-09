python3 -m venv local_env
source local_env/bin/activate
pip3 install -r requirements.txt
uvicorn main:app --reload
deactivate

