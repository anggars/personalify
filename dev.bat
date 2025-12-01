@echo off
echo Starting Local Personalify (Cloud DB Mode)...

:: 1. Set Path so Python knows the backend location
set PYTHONPATH=backend

:: 2. Activate Conda (Just in case you forgot to activate in the terminal)
call conda activate personalify

:: 3. Run Server
:: --reload is active so if the code is changed, the server restarts itself
uvicorn app.main:app --reload --port 8000