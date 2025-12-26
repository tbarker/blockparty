[![Tests](https://github.com/makoto/blockparty/actions/workflows/test.yml/badge.svg)](https://github.com/makoto/blockparty/actions/workflows/test.yml)

## What is this?

### Demo

[![Demo Video](./blockparty.gif)](https://www.youtube.com/watch?v=Tlt7oflkGng)

Have you ever encountered free party or meetup and realised that half the people registered did not actually turn up? BlockParty solves this problem by providing a simple incentive for people to register only if they mean it.

## How does this work?

Simple. You pay small deposit when you register. You lose your deposit if you do not turn up. You will get your deposit back + we split the deposit of whom did not turn up. You go to party and may end up getting more money.

## Targetted users

The current users are mostly participants of Blockchain related events, such as conference pre/post dinner, meetups, and hackathons. The users are expected to own some Ether (a virtual currency, shorten for ETH), to pay the deposit of the event, as well as usage fee of its platform called [Ethereum](http://ethereum.org).

![Diagram](http://blockparty.io.s3-website-eu-west-1.amazonaws.com/images/diagram.png)

## How to setup

### Option 1: Desktop browser with MetaMask

This is the most popular way.

1. Install [MetaMask](https://metamask.io/) browser extension
2. Create an account and make sure you have some Ether
3. Navigate to the event page

### Option 2: Mobile browser

A step by step guide is [here](https://medium.com/@makoto_inoue/participating-blockparty-event-with-a-mobile-wallet-b6b9123246f7).

1. Download a Web3 wallet ([MetaMask](https://metamask.io/), [Rainbow](https://rainbow.me/), or [Trust Wallet](https://trustwallet.com))
2. Create an account and fund it with some Ether
3. Open the event URL in the wallet's built-in browser

## How to play?

Type your twitter account, pick one of your address, then press 'RSVP'. It will take 10 to 30 seconds to get verified and you will receive notification. Once registered, join the party! Your party host (the contract owner) will mark you as attend. Once the host clicks `payout`, then you are entitled to `withdraw` your payout.

## FAQ

**Can I cancel my registration?**

No

**What happens if I do not withdraw my payout?**

If you do not withdraw your payout within one week after the event is end, the host (contract owner) will clear the balance from the contract and the remaining blance goes back to the host, so do not keep them hanging.

**What happens if the event is canceled?**

In case the event is canceled, all registered people can withdraw their deposit. Make sure that you register with correct twitter account so that the host can notify you.

**What if there is a bug in the contract!**

If the bug is found before the contract is compromised, the host can kill the contract and all the deposit goes back to the host so he/she can manually return the deposit. If the contract is compromised and the deposit is stolen, or his/her private key is lost/stolen, I am afraid that the host cannot compensate for you. Please assess the risk before you participate the event.

**Can I host my own event using BlockParty?**

Please contact the [author of this project](http://twitter.com/makoto_inoue) if you are interested.

## Terms and conditions

By downloading and deploying this software, you agree to our terms and conditions of use. We accept no responsibility whether in contract, tort or otherwise for any loss or damage arising out of or in connection with your use of our software and recommend that you ensure your devices are protected by using appropriate virus protection.

## Development Guide

If you are interested in contributing to blockparty, have a look into ["help wanted" tag on Github issues](https://github.com/makoto/blockparty/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22).

### Tech Stack

- **Smart Contracts**: Solidity 0.8.20
- **Contract Testing**: [Foundry/Forge](https://book.getfoundry.sh/)
- **Frontend**: React 18, MUI v7, ethers.js v6
- **Build**: Webpack 5
- **Package Manager**: npm

### Quick Start (VS Code Dev Container)

The easiest way to get started. Requires [VS Code](https://code.visualstudio.com/), [Docker](https://www.docker.com/products/docker-desktop/), and the [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers).

```bash
git clone https://github.com/makoto/blockparty.git
code blockparty
# Click "Reopen in Container" when prompted
```

This gives you Node.js 22, Foundry, and all dependencies ready to go.

### Local Installation

Requires Node.js 20+ and [Foundry](https://book.getfoundry.sh/getting-started/installation).

```bash
# Install Foundry (if not already installed)
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Clone and install
git clone https://github.com/makoto/blockparty.git
cd blockparty
npm install

# Generate test encryption keys (optional, for encryption tests)
mkdir -p tmp
openssl genrsa 2048 > tmp/test_private.key
openssl rsa -pubout < tmp/test_private.key > tmp/test_public.key
```

### Running Tests

```bash
# Smart contract tests (Forge)
npm run test              # or: forge test
npm run test -- -vvv      # verbose output

# UI component tests (Jest)
npm run test:ui

# Build verification tests
npm run test:build

# All tests
npm run test:all

# Linting
npm run lint
```

### Running Locally

```bash
# Start local Ethereum node (Anvil) with chain ID 1337
anvil --chain-id 1337
# Or use npm script:
npm run anvil

# Deploy contracts (in a new terminal)
forge script script/Deploy.s.sol:DeployConferenceLocal --broadcast --rpc-url http://localhost:8545

# Start dev server at http://localhost:8080
CONTRACT_ADDRESS=<deployed-address> npm run dev
```

NOTE: MetaMask accounts won't have Ether on Anvil. Use incognito mode to use Anvil's default funded accounts, or import one of Anvil's private keys.

### Contract Deployment

#### Local Development

```bash
# Start Anvil (Foundry's local node) with chain ID 1337
anvil --chain-id 1337

# Deploy with default settings
forge script script/Deploy.s.sol:DeployConferenceLocal --broadcast --rpc-url http://localhost:8545

# Deploy with custom settings
CONFERENCE_NAME="My Event" \
CONFERENCE_DEPOSIT=0.05ether \
CONFERENCE_LIMIT=50 \
forge script script/Deploy.s.sol:DeployConference --broadcast --rpc-url http://localhost:8545
```

#### Production Deployment

```bash
# Set your private key and RPC URL
export PRIVATE_KEY=your_private_key
export RPC_URL=https://mainnet.infura.io/v3/your-project-id

# Deploy
CONFERENCE_NAME="BlockParty Event" \
CONFERENCE_LIMIT=100 \
forge script script/Deploy.s.sol:DeployConference --broadcast --rpc-url $RPC_URL
```

### ENS Configuration (Development)

The frontend uses ethers.js built-in ENS support. For production networks (mainnet, testnets), ENS resolution works automatically.

For local development with ENS:

```bash
# Set ENS Registry address for the frontend
export ENS_ADDRESS=0xYourENSRegistryAddress

# Then start the dev server
npm run dev
```

### Building for Production

```bash
# Build contracts
forge build

# Build frontend (includes linting)
npm run build

# Upload contents of build/ directory to your hosting provider
```

### Project Structure

```
blockparty/
├── contracts/           # Solidity smart contracts
│   ├── Conference.sol   # Main event contract
│   ├── GroupAdmin.sol   # Multi-admin management
│   └── zeppelin/        # OpenZeppelin-style base contracts
├── test/                # Forge tests (Solidity)
│   ├── Conference.t.sol
│   └── GroupAdmin.t.sol
├── script/              # Forge deployment scripts
│   └── Deploy.s.sol
├── src/                 # React frontend
│   ├── index.js         # Main entry point (ethers.js)
│   ├── components/      # React components
│   └── __tests__/       # Jest UI tests
├── lib/                 # Forge dependencies (forge-std)
├── out/                 # Forge build output (ABIs, bytecode)
├── foundry.toml         # Forge configuration
└── package.json         # npm configuration
```

### Gas Reports

```bash
# Run tests with gas reporting
forge test --gas-report
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm run test:all`
5. Run linting: `npm run lint`
6. Submit a pull request

See [TODO.md](./TODO.md) for planned improvements and known issues.
