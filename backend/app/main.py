import os
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from app.routes import router
from app.db_handler import init_db
from fastapi.responses import RedirectResponse

load_dotenv()

app = FastAPI()

# --- Middleware 1: CORS (Izin untuk Vercel & Lokal) ---
# Ini adalah daftar origin yang benar untuk setup Anda.
origins = [
    "https://personalify.vercel.app", # Domain Vercel Anda
    "http://127.0.0.1:8000",        # Alamat localhost Anda
    "http://localhost:8000",         # Alamat localhost Anda
    "null"                         # Untuk saat buka file .html langsung dari komputer
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Middleware 2: Redirect Otomatis ke Vercel (Aman untuk Lokal) ---
@app.middleware("http")
async def redirect_if_not_vercel_or_local(request: Request, call_next):
    host = request.headers.get("host", "")
    # Header ini hanya ada jika request datang dari proxy Vercel
    vercel_host = request.headers.get("x-forwarded-host")

    # KONDISI: Redirect HANYA JIKA pengunjung datang langsung ke domain Render
    if "onrender.com" in host and not vercel_host:
        # Bangun URL Vercel yang lengkap
        vercel_url = f"https://personalify.vercel.app{request.url.path}"
        if request.url.query:
            vercel_url += f"?{request.url.query}"
        
        print(f"Redirecting direct Render traffic to: {vercel_url}")
        return RedirectResponse(url=vercel_url)

    # Biarkan request lewat jika dari Vercel atau localhost
    response = await call_next(request)
    return response

current_dir = os.path.dirname(os.path.abspath(__file__))
static_dir = os.path.join(current_dir, "static")
app.mount("/static", StaticFiles(directory=static_dir), name="static")

# Memasukkan semua endpoint dari routes.py
app.include_router(router)

# Menjalankan inisialisasi database saat startup
@app.on_event("startup")
def on_startup():
    init_db()