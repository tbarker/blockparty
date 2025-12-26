# BlockParty - Standalone Docker Image for CI/Testing
# For development, use VS Code Dev Containers (see .devcontainer/)

FROM node:22-bookworm

# Install required dependencies for native module compilation
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    git \
    openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first for better caching
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Generate test keys for encryption tests
RUN mkdir -p tmp && \
    openssl genrsa 2048 > tmp/test_private.key && \
    openssl rsa -pubout < tmp/test_private.key > tmp/test_public.key

# Expose ports
EXPOSE 8545 8080

# Default command - run UI tests (smart contract tests require external node)
CMD ["npm", "run", "test:ui"]
