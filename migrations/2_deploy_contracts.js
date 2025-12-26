const Conference = artifacts.require('./Conference.sol');
const coolingPeriod = 1 * 60 * 60 * 24 * 7;
// this is already required by truffle;
// NOTE: yargs must stay at v17.x - v18+ is ESM-only and incompatible with Truffle's CommonJS migrations
const yargs = require('yargs');
const fs = require('fs');
let encryption = '';
let config = {};
let name = ''; // empty name falls back to the contract default
let deposit = 0; // 0 falls back to the contract default
let tld = 'eth';
let limitOfParticipants = 0; // 0 falls back to the contract default
// eg: truffle migrate --config '{"name":"CodeUp No..", "limitOfParticipants":15, "encryption":"./tmp/test_public.key"}'
if (yargs.argv.config) {
  config = JSON.parse(yargs.argv.config);
}

module.exports = async function (deployer) {
  const app_config = require('../app_config.js')[deployer.network];
  console.log('app_config', app_config);
  const accounts = await web3.eth.getAccounts();
  let owner = accounts[0];
  if (deployer.network == 'test' || deployer.network == 'coverage')
    return 'no need to deploy contract';
  if (config.name) {
    name = config.name;
  }

  if (config.limitOfParticipants) {
    limitOfParticipants = config.limitOfParticipants;
  }

  if (config.encryption) {
    encryption = fs.readFileSync(config.encryption, { encoding: 'ascii' });
  }

  console.log([name, deposit, limitOfParticipants, coolingPeriod, encryption].join(','));
  await deployer.deploy(Conference, name, deposit, limitOfParticipants, coolingPeriod, encryption);

  if (deployer.network == 'development') {
    // Load pre-built ENS artifacts from npm packages
    // NOTE: These packages use Solidity 0.7.x and include pre-compiled JSON artifacts
    const TruffleContract = require('@truffle/contract');
    const namehash = require('eth-ens-namehash');

    // Load pre-built contract artifacts
    const ENSRegistryArtifact = require('@ensdomains/ens/build/contracts/ENSRegistry.json');
    const PublicResolverArtifact = require('@ensdomains/resolver/build/contracts/PublicResolver.json');
    const ReverseRegistrarArtifact = require('@ensdomains/ens/build/contracts/ReverseRegistrar.json');

    // Create truffle contract abstractions
    const ENS = TruffleContract(ENSRegistryArtifact);
    const PublicResolver = TruffleContract(PublicResolverArtifact);
    const ReverseRegistrar = TruffleContract(ReverseRegistrarArtifact);

    // Set provider for each contract
    ENS.setProvider(deployer.provider);
    PublicResolver.setProvider(deployer.provider);
    ReverseRegistrar.setProvider(deployer.provider);

    // Deploy contracts
    const ensInstance = await ENS.new({ from: owner });
    const resolverInstance = await PublicResolver.new(ensInstance.address, { from: owner });
    const reverseRegistrarInstance = await ReverseRegistrar.new(
      ensInstance.address,
      resolverInstance.address,
      { from: owner }
    );

    console.log('ENS deployed at:', ensInstance.address);
    console.log('PublicResolver deployed at:', resolverInstance.address);
    console.log('ReverseRegistrar deployed at:', reverseRegistrarInstance.address);

    // eth
    await ensInstance.setSubnodeOwner(
      '0x0000000000000000000000000000000000000000000000000000000000000000',
      web3.utils.sha3(tld),
      owner,
      { from: owner }
    );
    // reverse
    await ensInstance.setSubnodeOwner(
      '0x0000000000000000000000000000000000000000000000000000000000000000',
      web3.utils.sha3('reverse'),
      owner,
      { from: owner }
    );
    // addr.reverse
    await ensInstance.setSubnodeOwner(
      namehash.hash('reverse'),
      web3.utils.sha3('addr'),
      reverseRegistrarInstance.address,
      { from: owner }
    );
  }
};
