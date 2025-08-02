FROM python:3.12-slim

# Set folder kerja utama di /code
WORKDIR /code

# Copy file requirements terlebih dahulu untuk efisiensi cache
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy seluruh isi dari folder 'backend' lokal ke dalam folder '/code' di container
COPY backend/ .

# Perintah CMD sekarang akan dijalankan dari /code,
# dan Python akan bisa menemukan folder 'app' di dalamnya.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]