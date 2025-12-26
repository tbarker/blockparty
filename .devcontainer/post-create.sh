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

# Copy test keys to project tmp directory if they don't exist
echo "Setting up test encryption keys..."
mkdir -p tmp
if [ ! -f tmp/test_private.key ]; then
    cp /home/node/tmp/test_private.key tmp/
    cp /home/node/tmp/test_public.key tmp/
fi

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Available commands:"
echo "  npm run dev          - Start webpack dev server (http://localhost:8080)"
echo "  npm run test:ui      - Run React component tests"
echo "  npm run lint         - Run ESLint and Solhint"
echo "  anvil                - Start local Ethereum node (Foundry)"
echo "  forge test           - Run Solidity tests with Foundry"
echo ""
echo "For smart contract tests with Truffle (legacy):"
echo "  npx ganache &        - Start Ganache in background"
echo "  npm run test         - Run Truffle tests"
echo ""
