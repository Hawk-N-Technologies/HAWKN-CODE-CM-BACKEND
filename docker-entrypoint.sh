#!/bin/sh
set -e

# Display environment info
node -e '
  const env = require("./config/env");
  console.log(`==> Hawkn Backend initializing in [${env.NODE_ENV}] mode on port ${env.PORT}...`);
' 2>/dev/null || echo "==> Hawkn Backend initializing..."

echo "==> Running database migrations..."
npm run migrate

echo "==> Starting application server..."
exec "$@"
