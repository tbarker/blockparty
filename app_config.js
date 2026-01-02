// blockparty specific configs
module.exports = {
  development: {
    contract_addresses: {
      Conference: null, // Set via CONTRACT_ADDRESS env var or after deployment
    },
    factory_address: null, // Set via FACTORY_ADDRESS env var or after deployment
    name: 'LOCAL NET',
    etherscan_url: null,
  },
  test: {},
  sepolia: {
    contract_addresses: {
      Conference: null,
    },
    factory_address: null, // Deploy factory and set address here
    name: 'SEPOLIA TESTNET',
    etherscan_url: 'https://sepolia.etherscan.io',
  },
  goerli: {
    contract_addresses: {
      Conference: null,
    },
    factory_address: null,
    name: 'GOERLI TESTNET',
    etherscan_url: 'https://goerli.etherscan.io',
  },
  mainnet: {
    contract_addresses: {
      Conference: null, // Contract address should be provided via URL query parameter
    },
    factory_address: null, // Deploy factory and set address here
    name: 'MAINNET',
    etherscan_url: 'https://etherscan.io',
  },
};
