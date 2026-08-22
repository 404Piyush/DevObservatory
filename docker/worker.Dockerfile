FROM python:3.12-slim

WORKDIR /app/worker

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY worker/requirements.txt /app/worker/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy the minimal backend modules the worker needs to load Webhook rows
# and dispatch outbound webhooks.
COPY backend/app/db.py /app/worker/app/db.py
COPY backend/app/models.py /app/worker/app/models.py
COPY backend/app/webhooks.py /app/worker/app/webhooks.py
COPY backend/app/__init__.py /app/worker/app/__init__.py

COPY worker/ /app/worker/

CMD ["python", "worker.py"]