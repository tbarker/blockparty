# BlockParty Development Container
# Based on Microsoft's Node.js devcontainer with additional tooling for Ethereum development

FROM mcr.microsoft.com/devcontainers/typescript-node:1-22-bookworm

# Install system dependencies for native module compilation and Ethereum development
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    git \
    openssl \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set up workspace directory
WORKDIR /workspaces/blockparty

# Generate test RSA keys for encryption tests (as node user)
USER node
RUN mkdir -p /home/node/tmp && \
    openssl genrsa 2048 > /home/node/tmp/test_private.key && \
    openssl rsa -pubout < /home/node/tmp/test_private.key > /home/node/tmp/test_public.key

# Install Foundry (Ethereum development toolkit) - will be completed in postCreateCommand
# Foundry provides: forge (testing), cast (chain interaction), anvil (local node)
ENV PATH="/home/node/.foundry/bin:${PATH}"

USER root
