# BlockParty Development Container
# Based on Microsoft's Node.js devcontainer with additional tooling for Ethereum development

FROM mcr.microsoft.com/devcontainers/typescript-node:24-trixie

# Install system dependencies for native module compilation and Ethereum development
# Also includes dependencies required by Playwright for E2E testing
# And xvfb for Synpress headful browser testing
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    git \
    curl \
    # For Worktrunk
    rust-all \
    # Playwright/Chromium dependencies
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    # Synpress/MetaMask E2E testing requires headful browser
    # xvfb provides virtual X display for headful Chrome in containers
    xvfb \
    # Additional X11 libraries for headful browser rendering
    libx11-xcb1 \
    libxcb1 \
    libxext6 \
    libxrender1 \
    libxi6 \
    libxtst6 \
    libxss1 \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# Worktrunk tool
RUN cargo install cargo --force && cargo install worktrunk && wt config shell install

# Set up workspace directory
WORKDIR /workspaces/blockparty

# Install Foundry (Ethereum development toolkit) - will be completed in postCreateCommand
USER node
# Foundry provides: forge (testing), cast (chain interaction), anvil (local node)
ENV PATH="/home/node/.foundry/bin:${PATH}"

USER root
