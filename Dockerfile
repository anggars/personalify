FROM python:3.12-slim

WORKDIR /code

COPY backend/requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY ./backend /code/backend

CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]

