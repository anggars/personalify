import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from app.routes import router
from app.db_handler import init_db
from fastapi.middleware.cors import CORSMiddleware # <-- 1. Tambahkan import ini

load_dotenv()

app = FastAPI()

# ▼▼▼ 2. Tambahkan SELURUH BLOK KODE INI ▼▼▼
# Blok ini memberikan izin ke domain Vercel dan lingkungan lokal
origins = [
    "https://personalify.vercel.app", # Domain Vercel Anda nanti
    "http://127.0.0.1:5500",        # Untuk tes lokal (misal: VS Code Live Server)
    "null"                         # Untuk tes lokal (saat buka file .html langsung)
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
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