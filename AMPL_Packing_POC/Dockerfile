# AMPL Packing POC backend. Build from inside AMPL_Packing_POC/:
#   docker build -t ampl-packing-poc-backend .
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=18000 \
    DB_CONN_MAX_AGE=60

WORKDIR /app

COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY . .

RUN useradd --create-home --uid 10001 appuser && chown -R appuser /app
USER appuser

EXPOSE 18000

# Configuration comes from environment variables at runtime (see .env.example).
CMD ["sh", "-c", "python manage.py migrate --noinput && python manage.py collectstatic --noinput && gunicorn config.wsgi:application --bind 0.0.0.0:${PORT} --workers ${GUNICORN_WORKERS:-3} --timeout 30 --access-logfile -"]
