FROM python:3.12-slim

# 1. Buat folder kerja
WORKDIR /code

# 2. Copy file requirements dulu (untuk efisiensi cache)
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 3. Copy SELURUH folder backend ke dalam /code
# Ini akan membuat struktur /code/backend/app/...
COPY ./backend /code/backend

# 4. Set PYTHONPATH agar Python tahu di mana harus mencari modul
ENV PYTHONPATH=/code

# 5. Jalankan uvicorn dari folder yang benar
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]