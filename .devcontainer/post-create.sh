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
echo "  npm run dev              - Start webpack dev server (http://localhost:8080)"
echo "  npm run test:ui          - Run React component tests"
echo "  npm run lint             - Run ESLint and Solhint"
echo ""
echo "Smart contract development (Foundry):"
echo "  anvil                    - Start local Ethereum node"
echo "  forge test               - Run Solidity tests"
echo "  forge test -vvv          - Run tests with verbose output"
echo "  forge build              - Compile contracts"
echo "  forge coverage           - Generate coverage report"
echo ""
echo "Deployment:"
echo "  npm run deploy:local     - Deploy to local Anvil node"
echo "  # Or manually:"
echo "  forge script script/Deploy.s.sol:DeployConferenceLocal --broadcast --rpc-url http://localhost:8545"
echo ""
