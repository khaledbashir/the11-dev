FROM node:18-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY frontend/package.json frontend/pnpm-lock.yaml ./

# Install dependencies (use --no-frozen-lockfile for Docker CI environment)
RUN pnpm install --no-frozen-lockfile

# Copy source code
COPY frontend/ .

# Copy environment file for build-time variables
COPY frontend/.env .env.local

# Build the application with environment variables
RUN pnpm build

# Expose port
EXPOSE 3001

# Start the application
CMD ["pnpm", "start"]
