## v1.0

Major infrastructure modernization release.

### Smart Contract Tooling

- Migrate from Truffle to Foundry/Forge
- All contract tests rewritten in Solidity (46 tests)
- Add Forge deployment scripts (`script/Deploy.s.sol`)
- Use Anvil for local development (replaces Ganache)

### Frontend

- Migrate from web3.js to ethers.js v6
- Use native ethers.js ENS support
- Remove jQuery dependency
- Load contract ABIs from Forge output (`out/`)

### Removed

- Truffle configuration and migrations
- JavaScript contract tests (replaced by Solidity tests)
- web3.js and @truffle/contract dependencies
- Ganache (use Anvil instead)

## v0.9

- Upgrade to Solidity 0.8.20
- Upgrade to React 18 and MUI v7
- Upgrade to Node.js 22 LTS
- Add VS Code Dev Container
- Migrate CI from Travis to GitHub Actions
- Add ESLint 9 with flat config
- Add Solhint for Solidity linting

## v0.4

- Add Bounty program
- Support metamask

## v0.3

- Add restrictions so that only contract owner can execute `attend`, `payback`, and `cancel`
- Add limit on number of participants

## v0.2

- Support Mist
- Support Truffle 2.0

## v0.1

- Demo app
- Anyone can register, attend, payback
