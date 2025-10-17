FROM node:18-alpine

RUN npm install -g pnpm

WORKDIR /app

# Copy monorepo config
COPY pnpm-workspace.yaml ./
COPY pnpm-lock.yaml ./
COPY package.json ./
COPY turbo.json ./

# Copy packages and apps
COPY packages ./packages
COPY apps/web ./apps/web

# Install dependencies
RUN pnpm install

WORKDIR /app/apps/web

ENV PORT=3000
ENV NEXT_PUBLIC_BASE_URL=http://localhost:3333

EXPOSE 3000

# Run in dev mode instead of building
CMD ["pnpm", "dev"]
