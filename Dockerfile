FROM python:3.12-slim

# Set folder kerja utama di /code
WORKDIR /code

# Copy file requirements terlebih dahulu untuk efisiensi cache
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy seluruh isi dari folder 'backend' lokal ke dalam folder '/code' di container
COPY backend/ .

# Copy frontend files ke lokasi yang tepat
COPY frontend/ ../frontend/

# Jalankan uvicorn di port 10000 sesuai dokumentasi Render
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "10000"]