const Conference = artifacts.require('Conference.sol');
const twitterHandle = '@bighero6';
const gas = 1000000;
const gasPrice = 1;
const participantAttributes = ['participantName', 'addr', 'attended', 'paid'];

// Web3 1.x compatible time manipulation helper
const advanceTime = (time) => {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send({
      jsonrpc: '2.0',
      method: 'evm_increaseTime',
      params: [time],
      id: new Date().getTime()
    }, (err, result) => {
      if (err) { return reject(err); }
      return resolve(result);
    });
  });
};

const advanceBlock = () => {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send({
      jsonrpc: '2.0',
      method: 'evm_mine',
      id: new Date().getTime()
    }, (err, result) => {
      if (err) { return reject(err); }
      return resolve(result);
    });
  });
};

const advanceTimeAndBlock = async (time) => {
  await advanceTime(time);
  await advanceBlock();
};

const getParticipantDetail = function(participant, detail){
  return participant[participantAttributes.indexOf(detail)];
};

// Helper to get balance as BigInt
const getBalance = async (address) => {
  return BigInt(await web3.eth.getBalance(address));
};

contract('Conference', function(accounts) {
  const owner = accounts[0];
  const non_owner = accounts[1];
  let conference, deposit;

  beforeEach(async function(){
    conference = await Conference.new('', 0, 0, 0, '');
    deposit = BigInt((await conference.deposit.call()).toString());
  });

  describe('on changeName', function(){
    it('owner can rename the event', async function(){
      await conference.changeName('new name', {from:owner});
      assert.strictEqual((await conference.name.call()), 'new name');
    });

    it('non owner cannot rename the event', async function(){
      await conference.changeName('new name', {from:non_owner}).catch(function(){});
      assert.notEqual((await conference.name.call()), 'new name');
    });

    it('cannot rename the event once someone registered', async function(){
      await conference.register(twitterHandle, {value:deposit.toString()});
      await conference.changeName('new name', {from:owner}).catch(function(){});
      assert.notEqual((await conference.name.call()), 'new name');
    });
  });

  describe('on setLimitOfParticipants', function(){
    it('does not allow to register more than the limit', async function(){
      await conference.setLimitOfParticipants(1);
      await conference.register(twitterHandle, {value:deposit.toString()});
      assert.strictEqual((await conference.registered.call()).toNumber(), 1);
      await conference.register('anotherName', {from: non_owner, value:deposit.toString()}).catch(function(){});
      assert.strictEqual((await conference.registered.call()).toNumber(), 1);
    });

    it('returns only your deposit for multiple invalidations', async function(){
      await conference.setLimitOfParticipants.sendTransaction(2);
      await conference.register.sendTransaction(twitterHandle, {value:deposit.toString()});
      await conference.register.sendTransaction('anotherName', {from: accounts[1], value:deposit.toString()});
      assert.strictEqual((await conference.registered.call()).toNumber(), 2);
      let invalidTransaction = (deposit / 2n).toString();
      let beforeAccountBalance = await getBalance(accounts[2]);
      // Over capacity as well as wrong deposit value.
      await conference.register('anotherName', {from: accounts[2], value:invalidTransaction}).catch(function(){});
      assert.strictEqual((await conference.registered.call()).toNumber(), 2);
      let contractBalance = await getBalance(conference.address);
      assert.strictEqual(contractBalance, 2n * deposit);
      // does not become exactly equal because it loses some gas.
      let afterAccountBalance = await getBalance(accounts[2]);
      assert.strictEqual(beforeAccountBalance > afterAccountBalance, true);
    });
  });

  describe('on creation', function(){
    it('has default values', async function(){
      assert.strictEqual(await conference.name.call(), 'Test');
      assert.strictEqual((await conference.deposit.call()).toString(), web3.utils.toWei('0.02', 'ether'));
      assert.strictEqual((await conference.limitOfParticipants.call()).toNumber(), 20);
      assert.strictEqual((await conference.registered.call()).toNumber(), 0);
      assert.strictEqual((await conference.attended.call()).toNumber(), 0);
      assert.strictEqual((await conference.totalBalance.call()).toNumber(), 0);
    });

    it('can set config values', async function(){
      conference = await Conference.new('Test 1', web3.utils.toWei('2', 'ether'), 100, 2, 'public key');
      assert.strictEqual(await conference.name.call(), 'Test 1');
      assert.strictEqual((await conference.deposit.call()).toString(), web3.utils.toWei('2', 'ether'));
      assert.strictEqual((await conference.limitOfParticipants.call()).toNumber(), 100);
    });
  });

  describe('on registration', function(){
    let beforeContractBalance, beforeAccountBalance;

    beforeEach(async function(){
      beforeContractBalance = await getBalance(conference.address);
      await conference.register.sendTransaction(twitterHandle, {value:deposit.toString()});
    });

    it('increments registered', async function(){
      assert.equal((await conference.registered.call()).toNumber(), 1);
    });

    it('increases totalBalance', async function(){
      let totalBalance = BigInt((await conference.totalBalance.call()).toString());
      assert.equal(totalBalance - beforeContractBalance, deposit);
    });

    it('isRegistered for the registered account is true', async function(){
      assert.equal(await conference.isRegistered.call(owner), true);
    });

    it('isRegistered for the different account is not true', async function(){
      assert.equal(await conference.isRegistered.call(non_owner), false);
    });
  });

  describe('on failed registration', function(){
    it('cannot be registered if wrong amount of deposit is sent', async function(){
      let wrongDeposit = 5;
      let beforeContractBalance = await getBalance(conference.address);
      await conference.register.sendTransaction(twitterHandle, {from:owner, value:wrongDeposit}).catch(function(){});
      let afterContractBalance = await getBalance(conference.address);
      assert.strictEqual(afterContractBalance, beforeContractBalance);
      assert.equal(await conference.isRegistered.call(owner), false);
    });

    it('cannot register twice with same address', async function(){
      await conference.register.sendTransaction(twitterHandle, {from:owner, value:deposit.toString()});
      await conference.register.sendTransaction(twitterHandle, {from:owner, value:deposit.toString()}).catch(function(){});
      let contractBalance = await getBalance(conference.address);
      assert.strictEqual(contractBalance, deposit);
      assert.equal(await conference.registered.call(), 1);
      assert.equal(await conference.isRegistered.call(owner), true);
    });
  });

  describe('on attend', function(){
    let non_registered = accounts[4];
    let admin = accounts[5];

    beforeEach(async function(){
      await conference.register(twitterHandle, {value:deposit.toString(), from:non_owner});
    });

    it('can be called by owner', async function(){
      await conference.attend([non_owner], {from:owner});
      assert.equal(await conference.isAttended.call(non_owner), true);
      assert.equal((await conference.attended.call()).toNumber(), 1);
    });

    it('can be called by admin', async function(){
      await conference.grant([admin], {from:owner});
      await conference.attend([non_owner], {from:admin});
      assert.equal(await conference.isAttended.call(non_owner), true);
      assert.equal((await conference.attended.call()).toNumber(), 1);
    });

    it('cannot be called by non owner', async function(){
      await conference.attend([non_owner], {from:non_owner}).catch(function(){});
      assert.equal(await conference.isAttended.call(non_owner), false);
      assert.equal(await conference.attended.call(), 0);
      let participant = await conference.participants.call(non_owner);
      assert.equal(getParticipantDetail(participant, 'attended'), false);
    });

    it('isAttended is false if attended function for the account is not called', async function(){
      assert.equal(await conference.isAttended.call(owner), false);
    });

    it('cannot be attended if the list includes non registered address', async function(){
      await conference.attend([non_owner, non_registered], {from:owner}).catch(function(){});
      assert.equal(await conference.isAttended.call(non_owner), false);
      assert.equal(await conference.isAttended.call(non_registered), false);
      assert.equal((await conference.attended.call()).toNumber(), 0);
    });

    it('cannot be attended twice', async function(){
      await conference.attend([non_owner], {from:owner});
      await conference.attend([non_owner], {from:owner}).catch(function(){});
      assert.equal(await conference.isAttended.call(non_owner), true);
      assert.equal((await conference.attended.call()).toNumber(), 1);
    });
  });

  describe('on empty event', function(){
    let notAttended = accounts[3];

    it('nothing to withdraw if no one attend', async function(){
      await conference.payback({from:owner});
      assert.equal(await conference.payoutAmount.call(), 0);
    });
  });

  describe('on payback', function(){
    let previousBalance, currentRegistered, currentAttended;
    let attended = accounts[2];
    let notAttended = accounts[3];
    let notRegistered = accounts[4];

    beforeEach(async function(){
      await conference.register(twitterHandle, {from:attended, value:deposit.toString()});
      await conference.register(twitterHandle, {from:notAttended, value:deposit.toString()});
      await conference.attend([attended]);
    });

    it('cannot withdraw if non owner calls', async function(){
      await conference.payback({from:non_owner}).catch(function(){});
      await conference.withdraw({from:attended}).catch(function(){});
      // money is still left on contract
      let contractBalance = await getBalance(conference.address);
      assert.strictEqual(contractBalance, deposit * 2n);
      assert.equal(await conference.isPaid.call(attended), false);
    });

    it('cannot withdraw if you did not attend', async function(){
      await conference.payback({from:owner});
      await conference.withdraw({from:notAttended}).catch(function(){});
      // money is still left on contract
      let contractBalance = await getBalance(conference.address);
      assert.strictEqual(contractBalance, deposit * 2n);
      assert.equal(await conference.isPaid.call(notAttended), false);
    });

    it('can withdraw if you attend', async function(){
      await conference.payback({from:owner});
      previousBalance = await getBalance(attended);
      let contractBalance = await getBalance(conference.address);
      assert.strictEqual(contractBalance, deposit * 2n);
      await conference.withdraw({from:attended});
      contractBalance = await getBalance(conference.address);
      assert.strictEqual(contractBalance, 0n);
      let currentBalance = await getBalance(attended);
      let diff = currentBalance - previousBalance;
      assert( diff > (deposit * 19n / 10n));
      let participant = await conference.participants.call(attended);
      assert.equal(getParticipantDetail(participant, 'paid'), true);
      assert.equal(await conference.isPaid.call(attended), true);
    });

    it('cannot register any more', async function(){
      await conference.payback({from:owner});
      currentRegistered = await conference.registered.call();
      await conference.register('some handler', {from:notRegistered, value:deposit.toString()}).catch(function(){});
      assert.strictEqual((await conference.registered.call()).toNumber(), currentRegistered.toNumber());
      assert.equal(await conference.ended.call(), true);
    });

    // This is faiing. Potentially bug;
    it('cannot attend any more', async function(){
      await conference.payback({from:owner});
      currentAttended = await conference.attended.call();
      await conference.attend([notAttended], {from:owner}).catch(function(){});
      assert.strictEqual((await conference.attended.call()).toNumber(), currentAttended.toNumber());
      assert.equal(await conference.ended.call(), true);
    });
  });

  describe('on cancel', function(){
    let previousBalance, currentRegistered, currentAttended, diff, participant;
    let attended = accounts[2];
    let notAttended = accounts[3];
    let notRegistered = accounts[4];

    beforeEach(async function(){
      await conference.register(twitterHandle, {from:attended, value:deposit.toString()});
      await conference.register(twitterHandle, {from:notAttended, value:deposit.toString()});
      await conference.attend([attended]);
    });

    it('cannot cancel if non owner calls', async function(){
      await conference.cancel({from:non_owner}).catch(function(){});
      await conference.withdraw({from:attended}).catch(function(){});
      // money is still left on contract
      let contractBalance = await getBalance(conference.address);
      assert.strictEqual(contractBalance, deposit * 2n);
    });

    it('everybody receives refund', async function(){
      await conference.cancel();
      // attended
      previousBalance = await getBalance(attended);
      let contractBalance = await getBalance(conference.address);
      assert.strictEqual(contractBalance, deposit * 2n);
      await conference.withdraw({from:attended});
      contractBalance = await getBalance(conference.address);
      assert.strictEqual(contractBalance, deposit);
      let currentBalance = await getBalance(attended);
      diff = currentBalance - previousBalance;
      assert( diff > (deposit * 9n / 10n));
      participant = await conference.participants.call(attended);
      assert.equal(getParticipantDetail(participant, 'paid'), true);
      // notAttended
      previousBalance = await getBalance(notAttended);
      await conference.withdraw({from:notAttended});
      contractBalance = await getBalance(conference.address);
      assert.strictEqual(contractBalance, 0n);
      currentBalance = await getBalance(notAttended);
      diff = currentBalance - previousBalance;
      assert( diff > (deposit * 9n / 10n));
      participant = await conference.participants.call(notAttended);
      assert.equal(getParticipantDetail(participant, 'paid'), true);
    });

    it('cannot register any more', async function(){
      await conference.cancel();
      currentRegistered = await conference.registered.call();
      await conference.register('some handler', {from:notRegistered, value:deposit.toString()}).catch(function(){});
      assert.strictEqual((await conference.registered.call()).toNumber(), currentRegistered.toNumber());
      assert.equal(await conference.ended.call(), true);
    });
    // - cannot attend any more
    // - cannot payback any more

    it('cannot be canceled if the event is already ended', async function(){
      await conference.payback();
      await conference.cancel().catch(function(){});
      let contractBalance = await getBalance(conference.address);
      assert.strictEqual(contractBalance, deposit * 2n);
      await conference.withdraw({from:notAttended}).catch(function(){});
      contractBalance = await getBalance(conference.address);
      assert.strictEqual(contractBalance, deposit * 2n);
      await conference.withdraw({from:attended});
      contractBalance = await getBalance(conference.address);
      assert.strictEqual(contractBalance, 0n);
      assert.equal(await conference.ended.call(), true);
    });
  });

  describe('on withdraw', function(){
    let registered = accounts[1];
    let notRegistered = accounts[2];

    beforeEach(async function(){
      await conference.register(twitterHandle, {from:owner, value:deposit.toString()});
      await conference.register(twitterHandle, {from:registered, value:deposit.toString()});
      let contractBalance = await getBalance(conference.address);
      assert.strictEqual(contractBalance, deposit * 2n);
    });

    it('cannot withdraw twice', async function(){
      await conference.cancel({from:owner});
      await conference.withdraw({from:registered});
      await conference.withdraw({from:registered}).catch(function(){});
      // only 1 ether is taken out
      let contractBalance = await getBalance(conference.address);
      assert.strictEqual(contractBalance, deposit);
    });

    it('cannot withdraw if you did not register', async function(){
      await conference.cancel({from:owner});
      await conference.withdraw({from:notRegistered}).catch(function(){});
      let contractBalance = await getBalance(conference.address);
      assert.strictEqual(contractBalance, deposit * 2n);
    });
  });

  describe('on clear', function(){
    let one_week = 1 * 60 * 60 * 24 * 7;

    it('default cooling period is 1 week', async function(){
      assert.equal((await conference.coolingPeriod.call()).toNumber(), one_week);
    });

    it('cooling period can be set', async function(){
      conference = await Conference.new('', 0, 0, 10, '');
      assert.equal((await conference.coolingPeriod.call()).toNumber(), 10);
    });

    it('cannot be cleared by non owner', async function(){
      conference = await Conference.new('', 0, 0, 10, '');
      deposit = BigInt((await conference.deposit.call()).toString());
      await conference.register('one', {value:deposit.toString()});
      let contractBalance = await getBalance(conference.address);
      assert.strictEqual(contractBalance, deposit);
      await conference.clear({from:non_owner}).catch(function(){});
      contractBalance = await getBalance(conference.address);
      assert.strictEqual(contractBalance, deposit);
    });

    it('cannot be cleared if event is not ended', async function(){
      await conference.register('one', {value:deposit.toString()});
      let contractBalance = await getBalance(conference.address);
      assert.strictEqual(contractBalance, deposit);
      await conference.clear({from:owner}).catch(function(){});
      contractBalance = await getBalance(conference.address);
      assert.strictEqual(contractBalance, deposit);
    });

    it('cannot be cleared if cooling period is not passed', async function(){
      await conference.register('one', {value:deposit.toString()});
      await conference.cancel({from:owner});
      assert.equal(await conference.ended.call(), true);
      let contractBalance = await getBalance(conference.address);
      assert.strictEqual(contractBalance, deposit);
      await conference.clear({from:owner}).catch(function(){});
      contractBalance = await getBalance(conference.address);
      assert.equal(contractBalance, deposit);
    });

    it('owner receives the remaining if cooling period is passed', async function(){
      conference = await Conference.new('', 0, 0, 1, '');
      deposit = BigInt((await conference.deposit.call()).toString());

      await conference.register('one', {value:deposit.toString()});
      await conference.cancel({from:owner});
      assert.equal(await conference.ended.call(), true);
      let contractBalance = await getBalance(conference.address);
      assert.strictEqual(contractBalance, deposit);
      let previousBalance = await getBalance(owner);
      // Advance time by 2 seconds (cooling period is 1 second)
      await advanceTimeAndBlock(2);
      await conference.clear({from:owner});
      let currentBalance = await getBalance(owner);
      let diff = currentBalance - previousBalance;
      assert( diff > (deposit * 9n / 10n));
      contractBalance = await getBalance(conference.address);
      assert.strictEqual(contractBalance, 0n);
    });
  });
});
