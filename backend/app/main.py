import os
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from scalar_fastapi import get_scalar_api_reference

if not os.getenv("DATABASE_URL"):
    from dotenv import load_dotenv
    load_dotenv()

from app.routes import router
from app.db_handler import init_db
from fastapi.responses import RedirectResponse

app = FastAPI(docs_url=None, redoc_url=None)

origins = [
    "https://personalify.vercel.app",
    "http://127.0.0.1:8000",
    "http://localhost:8000",
    "http://localhost:3000",  # Next.js dev server
    "http://127.0.0.1:3000",  # Alternative localhost
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

# Static files mount removed (Frontend is Next.js)

app.include_router(router)

@app.get("/docs", include_in_schema=False)
async def scalar_html():
    return get_scalar_api_reference(
        openapi_url=app.openapi_url,
        title=app.title,
    )

@app.on_event("startup")
def on_startup():
    init_db()