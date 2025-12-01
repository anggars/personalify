@echo off
echo 🚀 Menyalakan Personalify Local (Cloud DB Mode)...

:: 1. Set Path biar Python tau lokasi backend
set PYTHONPATH=backend

:: 2. Aktifin Conda (Jaga-jaga kalo lupa activate di terminal)
call conda activate personalify

:: 3. Jalanin Server
:: --reload aktif biar kalau codingan diubah, server restart sendiri
uvicorn app.main:app --reload --port 8000