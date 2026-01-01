#!/bin/bash
set -e

echo "=== BlockParty Development Environment Setup ==="

# Install Foundry (Ethereum development toolkit)
echo "Installing Foundry..."
curl -L https://foundry.paradigm.xyz | bash
source /home/node/.bashrc 2>/dev/null || true
/home/node/.foundry/bin/foundryup

# Install npm dependencies
echo "Installing npm dependencies..."
npm install

# Install Forge dependencies (forge-std)
echo "Installing Forge dependencies..."
forge install --no-git 2>/dev/null || echo "Forge dependencies already installed"

# Build contracts
echo "Building contracts..."
forge build

# Install Chromium for Synpress E2E testing
# Both @playwright/test and Synpress use playwright-core@1.48.2 (Chromium 1140)
# The dependencies are deduped to node_modules/playwright-core
echo "Installing Chromium for Synpress (playwright-core 1.48.2 / Chromium 1140)..."
if [ -f "node_modules/playwright-core/cli.js" ]; then
    node node_modules/playwright-core/cli.js install chromium
else
    # Fallback to npx if direct path doesn't exist
    npx playwright install chromium || echo "Warning: Chromium installation may need manual intervention"
fi

# Build Synpress wallet cache (MetaMask extension setup)
# This pre-configures MetaMask with test wallet so E2E tests don't need to set it up each time
echo "Building Synpress wallet cache..."
SYNPRESS_WALLET_SETUP="src/__tests__/e2e-synpress/wallet-setup"
if [ -d "$SYNPRESS_WALLET_SETUP" ]; then
    # xvfb-run provides virtual display for headful browser in container
    xvfb-run npx synpress "$SYNPRESS_WALLET_SETUP" || echo "Warning: Synpress cache build failed. You may need to run: xvfb-run npx synpress $SYNPRESS_WALLET_SETUP"
else
    echo "Synpress wallet setup directory not found, skipping cache build"
fi

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Available commands:"
echo "  npm run dev              - Start webpack dev server (http://localhost:8080)"
echo "  npm run start            - Start dev server on port 3000 (for E2E tests)"
echo "  npm run test:ui          - Run React component tests"
echo "  npm run test:integration - Run contract integration tests (requires Anvil)"
echo "  npm run test:e2e         - Run E2E browser tests (requires Anvil)"
echo "  npm run lint             - Run ESLint and Solhint"
echo ""
echo "Smart contract development (Foundry):"
echo "  anvil                    - Start local Ethereum node"
echo "  forge test               - Run Solidity tests"
echo "  forge test -vvv          - Run tests with verbose output"
echo "  forge build              - Compile contracts"
echo "  forge coverage           - Generate coverage report"
echo ""
echo "E2E Testing (Synpress + MetaMask):"
echo "  npm run test:e2e         - Run E2E tests (requires Anvil running)"
echo "  Rebuild cache:           - xvfb-run npx synpress src/__tests__/e2e-synpress/wallet-setup"
echo ""
echo "Deployment:"
echo "  npm run deploy:local     - Deploy to local Anvil node"
echo ""
echo "AI Tools:"
echo "  opencode                 - Start opencode AI assistant"
echo ""
