// blockparty specific configs
module.exports = {
  development: {
    contract_addresses: {
      Conference: null, // Set via CONTRACT_ADDRESS env var or after deployment
    },
    name: 'LOCAL NET',
    etherscan_url: null,
  },
  test: {},
  sepolia: {
    contract_addresses: {
      Conference: null,
    },
    name: 'SEPOLIA TESTNET',
    etherscan_url: 'https://sepolia.etherscan.io',
  },
  goerli: {
    contract_addresses: {
      Conference: null,
    },
    name: 'GOERLI TESTNET',
    etherscan_url: 'https://goerli.etherscan.io',
  },
  mainnet: {
    contract_addresses: {
      Conference: null, // Contract address should be provided via URL query parameter
    },
    name: 'MAINNET',
    etherscan_url: 'https://etherscan.io',
  },
};
