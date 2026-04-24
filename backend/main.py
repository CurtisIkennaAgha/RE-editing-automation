#Learning APIs 

#create venv python -m venv .venv
#activate venv .venv\Scripts\activate.ps1
#to run api: uvicorn filename:app --reload
#access api http://127.0.0.1:5500

from moviepy import VideoFileClip, TextClip, CompositeVideoClip, concatenate_videoclips
import zipfile
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from typing import List
import os
import shutil
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

@app.post("/uploadoutro/")
async def upload_outro(clips: List[UploadFile] = File(...)):
    results = []
    for clip in clips:
        file_location = os.path.join(UPLOAD_DIR, clip.filename)
        with open(file_location, "wb") as f:
            f.write(await clip.read())
        file_info = {"filename": "Outro", "saved_to": file_location}
        save_file_metadata(file_info)
        results.append(file_info)
    return {"files": results}


# GET endpoint to return all uploaded files metadata
@app.get("/files/")
def get_files():
    return {"files": get_all_files()}

@app.delete("/clear/")
def clear():
    for filename in os.listdir(UPLOAD_DIR):
        file_path = os.path.join(UPLOAD_DIR, filename)
        if filename == "files.json":
            with open("uploads/files.json", "w") as f:
                f.write("[]")
        if filename == "timestamps.json":
            with open("uploads/timestamps.json", "w") as f:
                f.write("[]")
        if filename != "timestamps.json" and filename != "files.json":
            if os.path.isfile(file_path) or os.path.islink(file_path):
                os.unlink(file_path)  # Remove file or link
            elif os.path.isdir(file_path):
                shutil.rmtree(file_path)  # Remove directory and its contents


@app.post("/posttimestamps")
def post_timestamps(timestamps : List[str]):
    new_timestamps = ""
    with open("uploads/timestamps.json", "r") as t:
        new_timestamps = json.load(t)
    new_timestamps.extend(timestamps)

    with open("uploads/timestamps.json", "w") as t:
        json.dump(new_timestamps, t)

@app.post("/editclips")
def edit_clips():
        #load file and timestamps json
        with open("uploads/files.json", "r") as f:
            files = json.load(f)    
        with open("uploads/timestamps.json", "r") as t:
            timestamps = json.load(t)
        #search and save outro 
        outro = next(f for f in files if f["filename"] == "Outro")
        outro_clip = ( VideoFileClip(f"uploads/{outro['filename']}"))
        #loop through files, if theyre not outro edit them 
        for i, file in enumerate(files):
            if file["filename"] != "Outro":
                #find corresponding timestamp
                current_timestamp = timestamps[i]
                #load file as a clip and cut it to the timestamp
                clip = ( VideoFileClip(f"uploads/{file['filename']}")
                            .subclipped(0, current_timestamp)
                            
                        )
                #concatenate the clips togethere
                clip = concatenate_videoclips([clip, outro_clip])
                #save clip
                clip.write_videofile(f"edits/clip_{file['filename']}.mp4")



# from moviepy import VideoFileClip, TextClip, CompositeVideoClip

# # Load file example.mp4 and keep only the subclip from 00:00:10 to 00:00:20
# # Reduce the audio volume to 80% of its original volume

# clip = (
#     VideoFileClip("long_examples/example2.mp4")
#     .subclipped(10, 20)
#     .with_volume_scaled(0.8)
# )

@app.get("/downloadclips")
def download_clips():
    with zipfile.ZipFile("editedclips.zip", "w") as z:
        for filename in os.listdir("edits"):
            file_path = os.path.join("edits", filename)
            z.write(file_path)
    return FileResponse("editedclips.zip", media_type="application/zip")




    #return all edited clips 

