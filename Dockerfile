# Backend: Django + Gunicorn
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# psycopg2-binary / pillow ship manylinux wheels, so no compiler needed.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN chmod +x deploy/entrypoint.sh

EXPOSE 8000
CMD ["./deploy/entrypoint.sh"]
