const Conference = artifacts.require('Conference.sol');

let deposit, conference;
let twitterOne = '@twitter1';
var crypto = require('crypto');
var cryptoBrowserify = require('crypto-browserify');
var fs = require('fs');

const getTransaction = async function(type, transactionHash){
  let trxReceipt = await web3.eth.getTransactionReceipt(transactionHash);
  return [type, trxReceipt.gasUsed].join('\t');
};

contract('Encryption', function(accounts) {
  describe('on registration', function(){
    it('increments registered', async function(){
      var publicKey = fs.readFileSync('./test/fixtures/fixture_public.key', {encoding: 'ascii'});
      var privateKey = fs.readFileSync('./test/fixtures/fixture_private.key', {encoding: 'ascii'});
      var message = 'マコト';
      conference = await Conference.new('', 0, 0, 10, publicKey);
      var publicKeyFromContract = await conference.encryption.call();
      var encrypted = cryptoBrowserify.publicEncrypt(publicKeyFromContract, Buffer.from(message, 'utf-8'));

      console.log(await getTransaction('create   ', conference.transactionHash));
      deposit = BigInt((await conference.deposit.call()).toString());

      let result = await conference.registerWithEncryption(twitterOne, encrypted.toString('hex'), {value:deposit.toString()});
      console.log(await getTransaction('register   ', result.tx));

      // In web3 1.x / truffle 5.x, events are in result.logs
      let registerEvent = result.logs.find(log => log.event === 'RegisterEvent');
      assert(registerEvent, 'RegisterEvent should be emitted');

      let decrypted = crypto.privateDecrypt(privateKey, Buffer.from(registerEvent.args._encryption, 'hex'));
      console.log('decrypted', decrypted.toString('utf8'));
      assert.equal(decrypted.toString('utf8'), message);
    });
  });
});
