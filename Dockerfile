# Use Node.js alpine for smaller image size
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci && npm cache clean --force

# Install missing rollup native module explicitly
RUN npm install @rollup/rollup-linux-x64-musl --no-save

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application and package files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json

# Install production dependencies
RUN npm ci --production && npm cache clean --force
RUN npm install @rollup/rollup-linux-x64-musl --no-save

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 4173

# Set environment variables
ENV NODE_ENV=production

# Start the application
CMD ["npm", "run", "preview"]