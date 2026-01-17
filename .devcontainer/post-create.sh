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

# Install Chromium for Playwright E2E testing
echo "Installing Chromium for Playwright..."
npx playwright install chromium || echo "Warning: Chromium installation may need manual intervention"

# Prepare MetaMask for OnchainTestKit E2E tests
echo "Preparing MetaMask for E2E tests..."
if [ -f "scripts/prepare-metamask.mjs" ]; then
    node scripts/prepare-metamask.mjs || echo "Warning: MetaMask preparation may need manual intervention"
else
    echo "MetaMask preparation script not found, skipping"
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
echo "E2E Testing (OnchainTestKit + MetaMask):"
echo "  npm run test:e2e         - Run E2E tests (starts Anvil automatically)"
echo "  npm run test:e2e:debug   - Run E2E tests in debug mode"
echo ""
echo "Deployment:"
echo "  npm run deploy:local     - Deploy to local Anvil node"
echo ""
echo "AI Tools:"
echo "  opencode                 - Start opencode AI assistant"
echo "  clauded                  - Claude Code with --dangerously-skip-permissions"
echo ""

# Add claude alias to bashrc if not already present
if ! grep -q 'alias clauded=' ~/.bashrc 2>/dev/null; then
    echo 'alias clauded="claude --dangerously-skip-permissions"' >> ~/.bashrc
fi
