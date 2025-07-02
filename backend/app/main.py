from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from app.routes import router

load_dotenv()

app = FastAPI()
app.include_router(router)

# Serve frontend from public/
app.mount("/", StaticFiles(directory="public", html=True), name="frontend")
