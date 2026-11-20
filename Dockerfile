FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install build tools for native dependencies (such as bcrypt)
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --omit=dev

# Copy application source code
COPY . .

# Optional build-time argument for environment mode (staging or production)
ARG NODE_ENV
ENV NODE_ENV=${NODE_ENV}

# Ensure entrypoint script is executable
RUN chmod +x docker-entrypoint.sh

# Expose application ports (12121 for staging, 43211 for production)
EXPOSE 12121 43211

# Run migrations and start server
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
