#Learning APIs 

#create venv python -m venv .venv
#activate venv .venv\Scripts\activate.ps1
#to run api: uvicorn filename:app --reload
#access api http://127.0.0.1:5500


from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from typing import List
import os

import json

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

FILES_JSON = os.path.join(UPLOAD_DIR, "files.json")

def save_file_metadata(file_info):
    if os.path.exists(FILES_JSON):
        with open(FILES_JSON, "r") as f:
            files = json.load(f)
    else:
        files = []
    files.append(file_info)
    with open(FILES_JSON, "w") as f:
        json.dump(files, f)

def get_all_files():
    if os.path.exists(FILES_JSON):
        with open(FILES_JSON, "r") as f:
            return json.load(f)
    return []


@app.post("/upload/")
async def upload_files(clips: List[UploadFile] = File(...)):
    results = []
    for clip in clips:
        file_location = os.path.join(UPLOAD_DIR, clip.filename)
        with open(file_location, "wb") as f:
            f.write(await clip.read())
        file_info = {"filename": clip.filename, "saved_to": file_location}
        save_file_metadata(file_info)
        results.append(file_info)
    return {"files": results}


# GET endpoint to return all uploaded files metadata
@app.get("/files/")
def get_files():
    return {"files": get_all_files()}


#endpoint 2 - take in tmestampt for file number x 
#endpoint 3 - edit and return edite viedeos 