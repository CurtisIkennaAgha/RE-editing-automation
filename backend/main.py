#Learning APIs 

#create venv python -m venv .venv
#activate venv .venv\Scripts\activate.ps1
#to run api: uvicorn filename:app --reload
#access api http://127.0.0.1:5500

import random
from pydantic import BaseModel #makes easier to handle different data structures in api dev
from fastapi import FastAPI
from typing import Optional #allows variables to be optional
app = FastAPI()
