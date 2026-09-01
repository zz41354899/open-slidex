# ==========================================
# OpenSlideX Containerfile
# Multi-stage build with Chromium support
# ==========================================

# ---------- Stage 1: builder ----------
# Builds the runtime packages. Does not need Chromium/fonts since
# `npm run build:runtime` only bundles JS, it never launches a browser.
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Copy dependency manifests first for better layer caching
COPY package.json package-lock.json ./
COPY packages/editor-ui/package.json ./packages/editor-ui/
COPY packages/open-slidex/package.json ./packages/open-slidex/
COPY packages/open-slidex-mcp/package.json ./packages/open-slidex-mcp/
COPY packages/slidex-sdk/package.json ./packages/slidex-sdk/
COPY packages/slidex-workbench/package.json ./packages/slidex-workbench/

# Install all workspace dependencies (including dev, needed to build)
RUN npm ci --include=dev

# Copy all source files
COPY . .

# Build production runtime packages
RUN npm run build:runtime

# Drop devDependencies now so the copy into the final stage is already lean
RUN npm prune --omit=dev

# ---------- Stage 2: runtime ----------
FROM node:22-bookworm-slim AS runtime

# Install required system dependencies for headless Chromium, Sharp, and fonts (including CJK)
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-noto-cjk \
    fonts-noto-color-emoji \
    fonts-roboto \
    ca-certificates \
    libnss3 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libxkbcommon0 \
    libgbm1 \
    libasound2 \
    libxshmfence1 \
    && rm -rf /var/lib/apt/lists/*

ENV CHROME_PATH=/usr/bin/chromium \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium \
    OPEN_SLIDEX_HOST=0.0.0.0 \
    NODE_ENV=production

WORKDIR /app

# Pull the already-built app (pruned node_modules + compiled dist) from the builder stage
COPY --from=builder /app /app

# Create workspace directory and hand ownership to the unprivileged `node` user.
# Running Chromium as root requires --no-sandbox; running as a regular user avoids that.
RUN mkdir -p /app/open-slidex-workspace \
    && chown -R node:node /app

USER node

# Expose OpenSlideX Workspace port
EXPOSE 4172

# Persist user decks
VOLUME ["/app/open-slidex-workspace"]

# Report container health via the Workspace HTTP endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:4172/workspace').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Default entry command
CMD ["node", "packages/open-slidex/dist/cli.mjs", "workspace", "/app/open-slidex-workspace", "--port", "4172", "--no-open"]
