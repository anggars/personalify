import os
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
if not os.getenv("DATABASE_URL"):
    from dotenv import load_dotenv
    load_dotenv()
from app.routes import router
from app.db_handler import init_db
from fastapi.responses import RedirectResponse

app = FastAPI()

origins = [
    "https://personalify.vercel.app",
    "http://127.0.0.1:8000",
    "http://localhost:8000",
    "null"
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def redirect_if_not_vercel_or_local(request: Request, call_next):
    host = request.headers.get("host", "")
    vercel_host = request.headers.get("x-forwarded-host")

    if "onrender.com" in host and not vercel_host:
        vercel_url = f"https://personalify.vercel.app{request.url.path}"
        if request.url.query:
            vercel_url += f"?{request.url.query}"
        return RedirectResponse(url=vercel_url)

    response = await call_next(request)
    return response

@app.exception_handler(401)
async def unauthorized_handler(request: Request, exc):

    return RedirectResponse(url="/?error=session_expired")

@app.exception_handler(500)
async def internal_error_handler(request: Request, exc):

    print(f"CRITICAL ERROR: {exc}")
    return RedirectResponse(url="/?error=server_error")

current_dir = os.path.dirname(os.path.abspath(__file__))
static_dir = os.path.join(current_dir, "..", "..", "frontend", "static")
static_dir = os.path.abspath(static_dir)
app.mount("/static", StaticFiles(directory=static_dir), name="static")

app.include_router(router)

@app.on_event("startup")
def on_startup():
    init_db()