/**
 * Ganache integration test setup
 * Provides real blockchain interaction for integration tests
 */

const ganache = require('ganache');
const Web3 = require('web3');
const path = require('path');
const fs = require('fs');

let server;
let web3;
let accounts;
let conferenceContract;

// Contract artifacts path
const artifactsPath = path.join(__dirname, '../../../build/contracts/Conference.json');

/**
 * Start Ganache server and deploy contracts
 */
async function setupGanache() {
  // Start Ganache server
  server = ganache.server({
    wallet: {
      totalAccounts: 10,
      defaultBalance: 100,
    },
    logging: {
      quiet: true,
    },
  });

  await server.listen(8545);
  console.log('Ganache server started on port 8545');

  // Create Web3 instance
  web3 = new Web3('http://localhost:8545');
  accounts = await web3.eth.getAccounts();

  // Deploy Conference contract if artifacts exist
  if (fs.existsSync(artifactsPath)) {
    const artifacts = JSON.parse(fs.readFileSync(artifactsPath, 'utf8'));
    const Contract = new web3.eth.Contract(artifacts.abi);

    conferenceContract = await Contract.deploy({
      data: artifacts.bytecode,
      arguments: ['Test Event', 0, 20, 0, ''], // name, deposit, limit, cooling, encryption
    }).send({
      from: accounts[0],
      gas: 6000000,
    });

    console.log('Conference contract deployed at:', conferenceContract.options.address);
  }

  return {
    web3,
    accounts,
    conferenceContract,
  };
}

/**
 * Stop Ganache server
 */
async function teardownGanache() {
  if (server) {
    await server.close();
    console.log('Ganache server stopped');
  }
}

/**
 * Get deployed contract instance
 */
function getContract() {
  return conferenceContract;
}

/**
 * Get Web3 instance
 */
function getWeb3() {
  return web3;
}

/**
 * Get test accounts
 */
function getAccounts() {
  return accounts;
}

/**
 * Register a participant
 */
async function registerParticipant(twitterHandle, fromAccount, depositAmount) {
  if (!conferenceContract) {
    throw new Error('Contract not deployed. Run setupGanache first.');
  }

  const deposit = depositAmount || await conferenceContract.methods.deposit().call();

  return conferenceContract.methods.register(twitterHandle).send({
    from: fromAccount,
    value: deposit,
    gas: 200000,
  });
}

/**
 * Mark participant as attended
 */
async function attendParticipant(participantAddress, fromOwner) {
  if (!conferenceContract) {
    throw new Error('Contract not deployed. Run setupGanache first.');
  }

  return conferenceContract.methods.attend([participantAddress]).send({
    from: fromOwner,
    gas: 200000,
  });
}

/**
 * Get contract details
 */
async function getContractDetails() {
  if (!conferenceContract) {
    throw new Error('Contract not deployed. Run setupGanache first.');
  }

  const [name, deposit, registered, attended, ended, limitOfParticipants] = await Promise.all([
    conferenceContract.methods.name().call(),
    conferenceContract.methods.deposit().call(),
    conferenceContract.methods.registered().call(),
    conferenceContract.methods.attended().call(),
    conferenceContract.methods.ended().call(),
    conferenceContract.methods.limitOfParticipants().call(),
  ]);

  return {
    name,
    deposit,
    registered: parseInt(registered),
    attended: parseInt(attended),
    ended,
    limitOfParticipants: parseInt(limitOfParticipants),
  };
}

module.exports = {
  setupGanache,
  teardownGanache,
  getContract,
  getWeb3,
  getAccounts,
  registerParticipant,
  attendParticipant,
  getContractDetails,
};
