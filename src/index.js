import './stylesheets/app.css';
import 'react-notifications/lib/notifications.css';
import React from 'react';
import EventEmitter from 'event-emitter';
import { createRoot } from 'react-dom/client';
import Web3 from 'web3';
import TruffleContract from '@truffle/contract';
import artifacts from '../build/contracts/Conference.json';
// ENS artifacts from npm package (pre-built, uses Solidity 0.7.x)
import ENSArtifacts from '@ensdomains/ens/build/contracts/ENSRegistry.json';
import ConferenceDetail from './components/ConferenceDetail';
import FormInput from './components/FormInput';
import Notification from './components/Notification';
import Instruction from './components/Instruction';
import Participants from './components/Participants';
import NetworkLabel from './components/NetworkLabel';
import Data from './components/Data';

import Avatar from '@mui/material/Avatar';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import ENS from 'ethereum-ens';
import $ from 'jquery';

const theme = createTheme({
  palette: {
    primary: {
      main: '#607D8B',
    },
  },
});

async function setup() {
  let provider;
  let read_only = false;
  let url = 'http://localhost:8545';

  // Check if MetaMask or other Web3 provider is injected
  if (typeof window.ethereum !== 'undefined') {
    // Modern dapp browsers (MetaMask)
    provider = window.ethereum;
    window.web3 = new Web3(provider);
    try {
      // Request account access
      await window.ethereum.request({ method: 'eth_requestAccounts' });
    } catch (error) {
      console.log('User denied account access');
      read_only = true;
    }
    const network_id = await window.web3.eth.net.getId();
    return { web3: window.web3, provider, read_only, network_id: network_id.toString() };
  } else if (typeof web3 !== 'undefined') {
    // Legacy dapp browsers
    provider = web3.currentProvider;
    window.web3 = new Web3(provider);
    const network_id = await window.web3.eth.net.getId();
    return { web3: window.web3, provider, read_only, network_id: network_id.toString() };
  } else {
    // No injected web3, try local node or fallback to Infura
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Local node not available');
      provider = new Web3.providers.HttpProvider(url);
    } catch (error) {
      console.log('Local node not available, falling back to read_only mode');
      // Fallback to Infura (using Sepolia as Rinkeby is deprecated)
      if (Data[0].testnet) {
        url = 'https://sepolia.infura.io/v3/your-project-id';
      } else {
        url = 'https://mainnet.infura.io/v3/your-project-id';
      }
      read_only = true;
      provider = new Web3.providers.HttpProvider(url);
    }

    window.web3 = new Web3(provider);
    console.log('Web3 is set', window.web3, provider);

    try {
      const network_id = await window.web3.eth.net.getId();
      return { web3: window.web3, provider, read_only, network_id: network_id.toString() };
    } catch (error) {
      console.error('Failed to get network ID:', error);
      return { web3: window.web3, provider, read_only: true, network_id: '1' };
    }
  }
}

window.onload = function () {
  setup().then(({ provider, web3, read_only, network_id }) => {
    var env;
    switch (network_id) {
      case '1':
        env = 'mainnet';
        break;
      case '3':
        env = 'ropsten';
        break;
      case '4':
        env = 'rinkeby';
        break;
      default:
        env = 'development';
    }
    var network_obj = require('../app_config.js')[env];
    var Conference = TruffleContract(artifacts);
    var ENSContract = TruffleContract(ENSArtifacts);
    let contract, contractAddress;
    Conference.setProvider(provider);
    Conference.setNetwork(network_id);
    ENSContract.setProvider(provider);
    ENSContract.setNetwork(network_id);
    // For development/private networks, use ENS_ADDRESS env var or deployed ENS contract
    // For public networks (mainnet, testnets), use the canonical ENS registry
    const ensAddress = process.env.ENS_ADDRESS;
    if (ensAddress) {
      window.ens = new ENS(provider, ensAddress);
    } else if (parseInt(network_id) > 4) {
      window.ens = new ENS(provider, ENSContract.address);
    } else {
      window.ens = new ENS(provider);
    }
    try {
      if (network_obj.contract_addresses['Conference']) {
        contract = Conference.at(network_obj.contract_addresses['Conference']);
      } else {
        contract = Conference.at(Conference.address);
      }
    } catch (e) {
      console.log('ERROR');
      console.log(e);
    }
    if (contract) {
      contractAddress = contract.address;
    } else {
      contractAddress = '0x000';
    }

    let metadata = Data.filter(function (d) {
      return d.address == contractAddress;
    })[0];
    if (!metadata) {
      metadata = Data[0];
      metadata.address = contractAddress;
    }
    window.contract = contract;
    window.web3 = web3;
    const eventEmitter = EventEmitter();

    function getBalance(address) {
      return new Promise(function (resolve, _reject) {
        web3.eth.getBalance(address, function (err, result) {
          resolve(result);
        });
      });
    }
    // Functions to interact with contract
    function getDetail() {
      if (!contract) return false;

      var values;
      contract.then(function (instance) {
        Promise.all(
          [
            'name',
            'deposit',
            'payout',
            'totalBalance',
            'registered',
            'attended',
            'owner',
            'ended',
            'cancelled',
            'limitOfParticipants',
            'payoutAmount',
            'encryption',
            'getAdmins',
          ].map(attributeName => {
            return instance[attributeName].call();
          })
        )
          .then(_values => {
            values = _values;
            return getBalance(instance.address);
          })
          .then(contractBalance => {
            var detail = {
              name: values[0],
              deposit: values[1],
              payout: values[2],
              totalBalance: values[3],
              registered: values[4],
              attended: values[5],
              owner: values[6],
              ended: values[7],
              cancelled: values[8],
              limitOfParticipants: values[9],
              payoutAmount: values[10],
              encryption: values[11],
              admins: values[12],
              contractBalance: parseFloat(web3.utils.fromWei(contractBalance, 'ether')),
              date: metadata.date,
              map_url: metadata.map_url,
              location_text: metadata.location_text,
              description_text: metadata.description_text,
            };
            if (detail.ended) {
              detail.canRegister = false;
              detail.canAttend = false;
              detail.canPayback = false;
              detail.canCancel = false;
              detail.canWithdraw = true;
            } else {
              if (detail.registered.toNumber() > 0) {
                detail.canAttend = true;
              }

              if (
                detail.registered.toNumber() > 0 &&
                detail.attended.toNumber() > 0 &&
                detail.payout.toNumber() > 0
              ) {
                detail.canPayback = true;
              }
              detail.canRegister = true;
              detail.canCancel = true;
              detail.canWithdraw = false;
            }
            detail.contractAddress = contract.address;
            window.detail = detail;
            eventEmitter.emit('detail', detail);
          });
      });
    }

    function getParticipants(callback) {
      if (!contract) return false;

      var instance;

      contract
        .then(function (_instance) {
          instance = _instance;
          return instance.registered.call();
        })
        .then(value => {
          let participantsArray = [];
          for (var i = 1; i <= value.toNumber(); i++) {
            participantsArray.push(i);
          }
          return Promise.all(
            participantsArray.map(index => {
              let object;
              return instance.participantsIndex
                .call(index)
                .then(address => {
                  return instance.participants.call(address);
                })
                .then(participant => {
                  object = {
                    name: participant[0],
                    address: participant[1],
                    attended: participant[2],
                    paid: participant[3],
                  };
                  return window.ens.reverse(participant[1]).name();
                })
                .then(name => {
                  object.ensname = name;
                })
                .catch(() => {}) // ignore if ENS does not resolve.
                .then(() => {
                  return object;
                });
            })
          );
        })
        .then(participants => {
          if (participants) {
            eventEmitter.emit('participants_updated', participants);
            window.participants = participants.length;
            callback(participants);
          }
        });
    }
    var gas = 1000000;
    // default gas price
    window.gasPrice = web3.utils.toWei('3', 'gwei');
    $.get('https://ethgasstation.info/json/ethgasAPI.json', function (res) {
      window.gasPrice = web3.utils.toWei(String(res.safeLow / 10), 'gwei'); // for some reason the gast price is 10 times more expensive the one displayed on the web page.
    });
    window.eventEmitter = eventEmitter;
    function action(name, address, args) {
      var options = { from: address, gas: gas, gasPrice: window.gasPrice };
      eventEmitter.emit('notification', { status: 'info', message: 'Requested' });
      if (!args) {
        args = [];
      }
      if (name == 'register' || name == 'registerWithEncryption') {
        options.value = Math.pow(10, 18) / 50; // 0.02 ETH deposit
      }
      args.push(options);
      contract
        .then(function (instance) {
          return instance[name].apply(this, args);
        })
        .then(function (_trx) {
          eventEmitter.emit('notification', { status: 'success', message: 'Successfully Updated' });
          eventEmitter.emit('change');
          getDetail();
        })
        .catch(function (_e) {
          eventEmitter.emit('notification', { status: 'error', message: 'Error has occored' });
        });
    }

    // eslint-disable-next-line no-unused-vars
    function watchEvent() {
      contract.allEvents({ fromBlock: 0, toBlock: 'latest' }).watch(function (error, result) {
        if (error) {
          console.log('Error: ' + error);
        } else {
          console.log('watchEvent result', result);
        }
      });
    }

    function getAccounts() {
      if (read_only) {
        eventEmitter.emit('accounts_received', []);
        eventEmitter.emit('instruction');
        return false;
      }
      console.log('this is not read only!');
      web3.eth.getAccounts(function (err, accs) {
        if (err != null) {
          eventEmitter.emit('instruction');
          return;
        }
        if (accs.length == 0) {
          var message =
            "Couldn't get any accounts! Make sure your Ethereum client is configured correctly.";
          eventEmitter.emit('notification', { status: 'error', message: message });
          return;
        }
        window.account = accs[0];
        eventEmitter.emit('accounts_received', accs);
      });
    }

    const App = () => (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box>
          <AppBar position="static" sx={{ backgroundColor: '#607D8B' }}>
            <Toolbar>
              <Avatar
                src={require('./images/nightclub-white.png')}
                sx={{ width: 50, height: 50, bgcolor: 'rgb(96, 125, 139)', mr: 2 }}
              />
              <Typography
                variant="h4"
                component="div"
                sx={{
                  flexGrow: 1,
                  textAlign: 'center',
                  fontFamily: 'Lobster, cursive',
                }}
              >
                Block Party
                <Typography
                  component="span"
                  sx={{ fontSize: 'small', fontFamily: 'sans-serif', ml: 1 }}
                >
                  - NO BLOCK NO PARTY -
                </Typography>
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <NetworkLabel eventEmitter={eventEmitter} read_only={read_only} />
                <Button sx={{ color: 'white' }} onClick={() => eventEmitter.emit('instruction')}>
                  About
                </Button>
              </Box>
            </Toolbar>
          </AppBar>

          <Instruction eventEmitter={eventEmitter} />
          <Notification eventEmitter={eventEmitter} />
          <Box className="container foo">
            <ConferenceDetail
              eventEmitter={eventEmitter}
              getDetail={getDetail}
              web3={web3}
              contract={contract}
              contractAddress={contractAddress}
            />
            <Participants
              eventEmitter={eventEmitter}
              getDetail={getDetail}
              getParticipants={getParticipants}
              getAccounts={getAccounts}
              action={action}
              web3={web3}
            />
          </Box>
          <FormInput
            read_only={read_only}
            eventEmitter={eventEmitter}
            getAccounts={getAccounts}
            getDetail={getDetail}
            action={action}
          />
        </Box>
      </ThemeProvider>
    );

    const container = document.getElementById('app');
    const root = createRoot(container);
    root.render(<App />);

    window.getAccounts = getAccounts;

    // Looks like calling the function immediately returns
    // bignumber.js:1177 Uncaught BigNumber Error: new BigNumber() not a base 16 number:
    setTimeout(getAccounts, 100);
    setTimeout(getDetail, 100);
    eventEmitter.on('logger', payload => {
      // Optional logging server - fail silently if not available
      fetch('http://localhost:5000/log', {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        method: 'POST',
        body: JSON.stringify(payload),
      }).catch(() => {
        // Logging server not available - ignore
      });
      console.log('logger', payload);
    });
    let starTime = new Date();
    let timer = setInterval(() => {
      let duration = new Date() - starTime;
      if ((window.detail && window.participants) || duration > 200000) {
        let obj = {
          action: 'load',
          user: window.account,
          participants: window.participants,
          contract: window.detail && window.detail.contractAddress,
          agent: navigator.userAgent,
          duration: duration,
          provider: web3.currentProvider.constructor.name,
          hostname: window.location.hostname,
          created_at: new Date(),
        };
        eventEmitter.emit('logger', obj);
        clearInterval(timer);
      } else {
        console.log('not ready', window.detail, window.account, window.participants);
      }
    }, 1000);
    eventEmitter.emit('network', network_obj);
  });
};
