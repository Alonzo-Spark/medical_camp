#!/bin/bash
set -e

# Collect static (whitenoise serves /static). Migrations are run manually once
# (see DOCKER_DEPLOY.md) because Supabase's transaction pooler isn't ideal for
# DDL — so we don't auto-migrate on every boot.
python manage.py collectstatic --noinput

exec gunicorn \
    --workers 3 \
    --threads 4 \
    --timeout 120 \
    --bind 0.0.0.0:8000 \
    medicalcamp_inventory.wsgi:application
