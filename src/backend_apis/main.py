from fastapi import FastAPI, Path, Query, HTTPException, status
import dataplexutils.metadata.wizard as mw
app = FastAPI()


@app.get("/version")
def read_version():
    return {"version": mw.__version__}