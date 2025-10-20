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

# Build the application
RUN pnpm build

# Expose port
EXPOSE 3001

# Start the application
CMD ["pnpm", "start"]
