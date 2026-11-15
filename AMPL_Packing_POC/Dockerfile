# AMPL Packing POC backend.
# Supports running docker build from inside AMPL_Packing_POC/ or from the root directory:
#   From root:   docker build -f AMPL_Packing_POC/Dockerfile -t ampl-packing-poc-backend .
#   From root:   docker build -t ampl-packing-poc-backend AMPL_Packing_POC
#   From AMPL:   cd AMPL_Packing_POC && docker build -t ampl-packing-poc-backend .
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=18000 \
    DB_CONN_MAX_AGE=60

# Base directory for AMPL Packing POC
WORKDIR /AMPL_Packing_POC

# Copy context files and normalize base directory to AMPL_Packing_POC
# regardless of whether build context is repo root or AMPL_Packing_POC/
COPY . /tmp/build-context/

RUN if [ -d "/tmp/build-context/AMPL_Packing_POC" ]; then \
        cp -r /tmp/build-context/AMPL_Packing_POC/. /AMPL_Packing_POC/; \
    else \
        cp -r /tmp/build-context/. /AMPL_Packing_POC/; \
    fi && \
    rm -rf /tmp/build-context && \
    rm -rf /AMPL_Packing_POC/.venv /AMPL_Packing_POC/venv

# Install Python dependencies
RUN pip install --upgrade pip && pip install -r requirements.txt

# Create application user, create /app compatibility symlink, and set ownership
RUN useradd --create-home --uid 10001 appuser && \
    chown -R appuser /AMPL_Packing_POC && \
    ln -s /AMPL_Packing_POC /app

USER appuser

EXPOSE 18000

# Configuration comes from environment variables at runtime (see .env.example).
CMD ["sh", "-c", "python manage.py migrate --noinput && python manage.py collectstatic --noinput && gunicorn config.wsgi:application --bind 0.0.0.0:${PORT} --workers ${GUNICORN_WORKERS:-3} --timeout 30 --access-logfile -"]
