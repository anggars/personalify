import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from app.routes import router
from app.db_handler import init_db

load_dotenv()

app = FastAPI()

# CORS middleware untuk Vercel
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://personalify.vercel.app",
        "https://*.vercel.app",
        "http://localhost:3000",
        "http://127.0.0.1:8000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Perbaikan Path Statis ---
# Mendapatkan path absolut ke direktori tempat file ini berada
current_dir = os.path.dirname(os.path.abspath(__file__))
static_dir = os.path.join(current_dir, "static")

# Mount static files dengan path yang sudah pasti benar
app.mount("/static", StaticFiles(directory=static_dir), name="static")
# --- Akhir Perbaikan ---

app.include_router(router)

@app.on_event("startup")
def on_startup():
    init_db()