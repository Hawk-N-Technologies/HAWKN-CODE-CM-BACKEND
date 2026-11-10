#!/bin/sh
set -e

echo "==> Running database migrations..."
npm run migrate

echo "==> Starting application on port ${PORT:-12121}..."
exec "$@"
