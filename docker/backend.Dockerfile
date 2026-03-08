FROM python:3.12-slim

WORKDIR /app/backend

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ /app/backend/

EXPOSE 8000

CMD ["sh", "-c", "PYTHONPATH=/app/backend alembic -c alembic.ini upgrade head && PYTHONPATH=/app/backend uvicorn app.main:app --host 0.0.0.0 --port 8000"]
