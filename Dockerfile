# BlockParty - Standalone Docker Image for CI/Testing
# For development, use VS Code Dev Containers (see .devcontainer/)

FROM node:22-bookworm

# Install required dependencies for native module compilation and Foundry
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    git \
    openssl \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Foundry
RUN curl -L https://foundry.paradigm.xyz | bash && \
    /root/.foundry/bin/foundryup

# Add Foundry to PATH
ENV PATH="/root/.foundry/bin:${PATH}"

WORKDIR /app

# Copy package files first for better caching
COPY package.json package-lock.json* ./

# Install npm dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Install Forge dependencies
RUN forge install --no-git || true

# Build contracts
RUN forge build

# Generate test keys for encryption tests
RUN mkdir -p tmp && \
    openssl genrsa 2048 > tmp/test_private.key && \
    openssl rsa -pubout < tmp/test_private.key > tmp/test_public.key

# Expose ports
EXPOSE 8545 8080

# Default command - run UI tests
CMD ["npm", "run", "test:ui"]
