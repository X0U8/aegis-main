# Stage 1: Build TypeScript backend
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package manifests and install dependencies
COPY package*.json tsconfig.json ./
RUN npm ci

# Copy source code and build
COPY src/ ./src/
RUN npm run build

# Stage 2: Production runtime image
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Copy package manifests and install production dependencies only
COPY package*.json ./
RUN npm ci --only=production

# Copy compiled JavaScript output from builder stage
COPY --from=builder /app/dist ./dist

# Expose port (Cloud Run sets PORT=8080 by default)
EXPOSE 8080

# Start Aegis Sentinel Public Server
CMD ["node", "dist/src/server/sentinelServer.js"]
