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

### Quick Start (VS Code Dev Container)

The easiest way to get started. Requires [VS Code](https://code.visualstudio.com/), [Docker](https://www.docker.com/products/docker-desktop/), and the [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers).

```bash
git clone https://github.com/makoto/blockparty.git
code blockparty
# Click "Reopen in Container" when prompted
```

This gives you Node.js 22, Foundry, and all dependencies ready to go.

### Local Installation

Requires Node.js 20+ and OpenSSL.

```bash
npm install

# Generate test encryption keys
mkdir -p tmp
openssl genrsa 2048 > tmp/test_private.key
openssl rsa -pubout < tmp/test_private.key > tmp/test_public.key
```

### Running Tests

```bash
# UI component tests (fast, no blockchain required)
npm run test:ui

# Build verification tests (verifies webpack build succeeds)
npm run test:build

# Smart contract tests
npx ganache &
npm run test

# All tests
npm run test:all

# Linting
npm run lint
```

The build verification tests (`test:build`) catch webpack configuration issues, missing polyfills, and import errors that component tests might miss.

### Running Locally

```bash
npx ganache                                # Start local node
npx truffle migrate --network development  # Deploy contracts
npm run dev                                # Start dev server at http://localhost:8080
```

NOTE: MetaMask accounts won't have Ether on Ganache. Use incognito mode to use the local node's default accounts.

### ENS Configuration (Development)

When deploying to the development network, ENS contracts are automatically deployed and their addresses are logged. To use the ENS helper script for registering names:

```bash
# After migration, note the logged ENS contract addresses, then:
npx truffle exec scripts/ens.js \
  -n myname \
  -a 0xYourAddress \
  --ens 0xENSRegistryAddress \
  --resolver 0xPublicResolverAddress \
  --reverse 0xReverseRegistrarAddress \
  --network development
```

Alternatively, you can set the ENS address as an environment variable for the frontend:

```bash
# Set ENS Registry address for the frontend
export ENS_ADDRESS=0xYourENSRegistryAddress

# Then start the dev server
npm run dev
```

For production networks (mainnet, testnets), the frontend automatically uses the canonical ENS registry addresses.

### Building

```bash
npm run build
# Upload contents of build/ directory
```

### Contract Configuration

Event name and participant limit are configurable at deployment:

```bash
npx truffle migrate --config '{"name":"My Event", "limitOfParticipants":50}'
```

Encryption of participant names (experimental):

```bash
npx truffle migrate --config '{"name":"My Event", "encryption":"./tmp/test_public.key"}'
```

## Deploying to Mainnet

Deploys via Infura:

```bash
npx truffle migrate --network mainnet --mnemonic $SECRET
```

See `truffle-config.js` and `scripts/util/set_gas.js` for gas price configuration.
