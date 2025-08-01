# backend/app/main.py

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

from app.routes import router
# Ganti import ini
from app.db_handler import init_db_pool, create_tables

load_dotenv()

app = FastAPI()
app.mount("/static", StaticFiles(directory="app/static"), name="static")
app.include_router(router)

@app.on_event("startup")
def on_startup():
    # Ganti panggilan fungsi ini
    init_db_pool()
    # Kita juga bisa panggil create_tables di sini agar tabel selalu ada
    create_tables()