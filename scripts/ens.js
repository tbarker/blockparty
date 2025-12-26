// ENS helper script for development network
// NOTE: This script requires ENS contracts to be deployed first via `truffle migrate --network development`
// The contract addresses must be provided via command line arguments

const namehash = require('eth-ens-namehash');
// NOTE: yargs must stay at v17.x - v18+ is ESM-only and incompatible with Truffle's CommonJS
const yargs = require('yargs');
const TruffleContract = require('@truffle/contract');

// Load pre-built contract artifacts
const ENSRegistryArtifact = require('@ensdomains/ens/build/contracts/ENSRegistry.json');
const PublicResolverArtifact = require('@ensdomains/resolver/build/contracts/PublicResolver.json');
const ReverseRegistrarArtifact = require('@ensdomains/ens/build/contracts/ReverseRegistrar.json');

let arg = yargs
  .usage(
    'Usage: truffle exec scripts/ens.js -n $DOMAIN_NAME -a $ADDRESS --ens $ENS_ADDRESS --resolver $RESOLVER_ADDRESS --reverse $REVERSE_REGISTRAR_ADDRESS'
  )
  // avoid address to hex conversion
  .coerce(['a', 'ens', 'resolver', 'reverse'], function (arg) {
    return arg;
  })
  .demandOption(['n', 'a', 'ens', 'resolver', 'reverse']).argv;

let address = arg.a;
let name = arg.n;
let tld = 'eth';
let hashedname = namehash.hash(`${name}.eth`);

module.exports = async function (callback) {
  try {
    // Create truffle contract abstractions
    const ENS = TruffleContract(ENSRegistryArtifact);
    const PublicResolver = TruffleContract(PublicResolverArtifact);
    const ReverseRegistrar = TruffleContract(ReverseRegistrarArtifact);

    // Set provider
    ENS.setProvider(web3.currentProvider);
    PublicResolver.setProvider(web3.currentProvider);
    ReverseRegistrar.setProvider(web3.currentProvider);

    // Get contract instances at specified addresses
    let ens = await ENS.at(arg.ens);
    let resolver = await PublicResolver.at(arg.resolver);
    let reverseresolver = await ReverseRegistrar.at(arg.reverse);

    let accounts = await web3.eth.getAccounts();
    let owner = accounts[0];

    console.log(`Registering ${name}.eth for address ${address}`);

    await ens.setSubnodeOwner(namehash.hash(tld), web3.utils.sha3(name), owner, { from: owner });
    await ens.setResolver(hashedname, resolver.address, { from: owner });
    await resolver.methods['setAddr(bytes32,address)'](hashedname, address, { from: owner });

    let res1 = await resolver.methods['addr(bytes32)'](hashedname);
    console.log(res1, '==', address);

    await reverseresolver.setName(`${name}.eth`, { from: address });
    let res2 = await resolver.name(namehash.hash(`${address.slice(2).toLowerCase()}.addr.reverse`));
    console.log(res2, '==', `${name}.eth`);

    callback();
  } catch (error) {
    callback(error);
  }
};
