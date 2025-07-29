# NEAR Shade Agent TEE Dockerfile
# Optimized for Intel TDX TEE deployment on Phala Cloud

FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install system dependencies for TEE environment
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    curl \
    ca-certificates \
    && update-ca-certificates

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY src/ ./src/
COPY public/ ./public/

# Build the application
RUN npm run build

# Create non-root user for TEE security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Set proper ownership
RUN chown -R nextjs:nodejs /app
USER nextjs

# Expose port for TEE access
EXPOSE 3000

# Health check for TEE monitoring
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Start the TEE solver
CMD ["npm", "start"]