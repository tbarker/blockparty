# BlockParty - Standalone Docker Image for CI/Testing
# For development, use VS Code Dev Containers (see .devcontainer/)

FROM node:22-bookworm

# Install required dependencies for native module compilation and Foundry
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Foundry
RUN curl -L https://foundry.paradigm.xyz | bash && \
    /root/.foundry/bin/foundryup

# Add Foundry to PATH
ENV PATH="/root/.foundry/bin:${PATH}"

WORKDIR /app

# Copy package files and scripts first for better caching
# (scripts/ needed for postinstall hook)
COPY package.json package-lock.json* ./
COPY scripts/ ./scripts/

# Install npm dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Initialize git submodules (lib/ excluded via .dockerignore, so clone fresh)
RUN git submodule update --init --recursive

# Build contracts
RUN forge build

# Expose ports
EXPOSE 8545 8080

# Default command - run UI tests
CMD ["npm", "run", "test:ui"]
