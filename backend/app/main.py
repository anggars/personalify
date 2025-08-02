import os  # <-- Tambah import ini
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

from app.routes import router
from app.db_handler import init_db

load_dotenv()

app = FastAPI()
app.mount("/static", StaticFiles(directory="app/static"), name="static")
app.include_router(router)

@app.on_event("startup")
def on_startup():
    # --- KODE DEBUGGING SEMENTARA ---
    print("=" * 50)
    print("MEMERIKSA ENVIRONMENT VARIABLES YANG DITERIMA APLIKASI:")
    
    database_url = os.getenv("DATABASE_URL")
    redis_url = os.getenv("REDIS_URL")
    
    if database_url:
        print(f"✅ DATABASE_URL ditemukan!")
        # Kita sensor sebagian isinya untuk keamanan
        print(f"   Value: {database_url[:15]}...") 
    else:
        print(f"❌ DATABASE_URL TIDAK DITEMUKAN (None).")

    if redis_url:
        print(f"✅ REDIS_URL ditemukan!")
    else:
        print(f"❌ REDIS_URL TIDAK DITEMUKAN (None).")
        
    print("=" * 50)
    # --- AKHIR KODE DEBUGGING ---
    
    # Kita tetap panggil init_db() agar bisa melihat error aslinya juga
    print("Sekarang mencoba menjalankan init_db()...")
    init_db()