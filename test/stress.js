const moment = require('moment');
const fs = require('fs');
const Conference = artifacts.require('Conference.sol');

const Tempo = require('@digix/tempo');
const { wait, waitUntilBlock } = require('@digix/tempo')(web3);
const gasPrice = web3.utils.toWei('1', 'gwei');
const usd = 468;
let deposit, conference;
let trx,trx2, gasUsed, gasUsed2, result, trxReceipt;

const pad = function(n, width, z) {
  z = z || '0';
  n = n + '';
  return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
};

const getTransaction = async function(type, transactionHash){
  trx = await web3.eth.getTransaction(transactionHash);
  trxReceipt = await web3.eth.getTransactionReceipt(transactionHash);
  gasUsed = BigInt(trxReceipt.gasUsed) * BigInt(trx.gasPrice);
  result = {
    'type             ': type,
    'gasUsed       ': trxReceipt.gasUsed,
    'gasPrice': web3.utils.fromWei(trx.gasPrice.toString(),'gwei'),
    '1ETH*USD': usd,
    'gasUsed*gasPrice(Ether)': web3.utils.fromWei(gasUsed.toString(),'ether'),
    'gasUsed*gasPrice(USD)': parseFloat(web3.utils.fromWei(gasUsed.toString(),'ether')) * usd,
  };
  return result;
};

const formatArray = function(array){
  return array.join('\t\t');
};

const getBalance = async (address) => {
  return BigInt(await web3.eth.getBalance(address));
};

const reportTest = async function (participants, accounts){
  const addresses = [];
  const transactions = [];
  const encrypted_codes = [];
  const owner = accounts[0];
  conference = await Conference.new('Test', 0, participants, 0, '', {gasPrice:gasPrice});
  transactions.push(await getTransaction('create   ', conference.transactionHash));
  deposit = BigInt((await conference.deposit.call()).toString());

  for (var i = 0; i < participants; i++) {
    var registerTrx = await conference.register('test', {from:accounts[i], value:deposit.toString(), gasPrice:gasPrice});
    if ((i % 100) == 0 && i != 0) {
      console.log('register', i);
    }
    if (i == 0) {
      transactions.push(await getTransaction('register', registerTrx.tx));
    }
    addresses.push(accounts[i]);
  }
  var attendTrx = await conference.attend(addresses, {from:owner, gasPrice:gasPrice});
  transactions.push(await getTransaction('batchAttend  ', attendTrx.tx));

  assert.strictEqual((await conference.registered.call()).toNumber(), participants);
  let contractBalance = await getBalance(conference.address);
  assert.strictEqual(contractBalance, deposit * BigInt(participants));

  trx = await conference.payback({from:owner, gasPrice:gasPrice});
  transactions.push(await getTransaction('payback ', trx.tx));
  for (var i = 0; i < participants; i++) {
    trx = await conference.withdraw({from:accounts[i], gasPrice:gasPrice});
    if (i == 0) {
      transactions.push(await getTransaction('withdraw', trx.tx));
    }
  }
  var header = Object.keys(transactions[0]).join('\t');
  var bodies = [header];
  console.log(header);
  for (var i = 0; i < transactions.length; i++) {
    var row = formatArray(Object.values(transactions[i]));
    console.log(row);
    bodies.push(row);
  }
  var date = moment().format('YYYYMMDD');
  fs.writeFileSync(`./log/stress_${pad(participants, 4)}.log`, bodies.join('\n') + '\n');
  fs.writeFileSync(`./log/stress_${pad(participants, 4)}_${date}.log`, bodies.join('\n') + '\n');
};

contract('Stress test', function(accounts) {
  describe('stress test', function(){
    it('can handle 2 participants', async function(){
      await reportTest(2, accounts);
    });

    it('can handle 20 participants', async function(){
      await reportTest(20, accounts);
    });

    it('can handle 100 participants', async function(){
      await reportTest(100, accounts);
    });

    it('can handle 200 participants', async function(){
      await reportTest(200, accounts);
    });

    it('can handle 300 participants', async function(){
      await reportTest(300, accounts);
    });
  });
});
