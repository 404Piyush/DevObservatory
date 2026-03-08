FROM python:3.12-slim

WORKDIR /app/worker

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY worker/requirements.txt /app/worker/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY worker/ /app/worker/

CMD ["python", "worker.py"]
