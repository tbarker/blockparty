import './stylesheets/app.css';
import React from 'react';
import EventEmitter from 'event-emitter';
import { createRoot } from 'react-dom/client';
import { ethers } from 'ethers';
// Use Forge output for contract ABI
import ConferenceArtifact from '../out/Conference.sol/Conference.json';
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

const theme = createTheme({
  palette: {
    primary: {
      main: '#607D8B',
    },
  },
});

// Conference contract ABI from Forge output
const ConferenceABI = ConferenceArtifact.abi;

async function setup() {
  let provider;
  let signer = null;
  let read_only = false;
  const localUrl = 'http://localhost:8545';

  // Check if MetaMask or other Web3 provider is injected
  if (typeof window.ethereum !== 'undefined') {
    // Modern dapp browsers (MetaMask)
    provider = new ethers.BrowserProvider(window.ethereum);
    try {
      // Request account access
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      signer = await provider.getSigner();
    } catch (error) {
      console.log('User denied account access');
      read_only = true;
    }
    const network = await provider.getNetwork();
    return { provider, signer, read_only, network_id: network.chainId.toString() };
  } else {
    // No injected provider, try local node or fallback to Infura
    try {
      provider = new ethers.JsonRpcProvider(localUrl);
      // Test connection
      await provider.getNetwork();
      console.log('Connected to local node');
    } catch (error) {
      console.log('Local node not available, falling back to read_only mode');
      // Fallback to Infura (using Sepolia as Rinkeby is deprecated)
      const infuraUrl = Data[0].testnet
        ? 'https://sepolia.infura.io/v3/your-project-id'
        : 'https://mainnet.infura.io/v3/your-project-id';
      read_only = true;
      provider = new ethers.JsonRpcProvider(infuraUrl);
    }

    try {
      const network = await provider.getNetwork();
      return { provider, signer: null, read_only, network_id: network.chainId.toString() };
    } catch (error) {
      console.error('Failed to get network:', error);
      return { provider, signer: null, read_only: true, network_id: '1' };
    }
  }
}

window.onload = function () {
  setup().then(async ({ provider, signer, read_only, network_id }) => {
    let env;
    switch (network_id) {
      case '1':
        env = 'mainnet';
        break;
      case '11155111':
        env = 'sepolia';
        break;
      case '5':
        env = 'goerli';
        break;
      default:
        env = 'development';
    }

    const network_obj =
      require('../app_config.js')[env] || require('../app_config.js')['development'];

    let contract = null;
    let contractAddress = null;
    let contractError = null;

    // Parse contract address from URL query parameter
    const urlParams = new URLSearchParams(window.location.search);
    const contractFromUrl = urlParams.get('contract');

    try {
      // Get contract address with priority:
      // 1. URL query parameter (?contract=0x...)
      // 2. E2E config (for testing)
      // 3. app_config.js (network-based)
      // 4. CONTRACT_ADDRESS env variable
      if (contractFromUrl) {
        // Validate the address format
        if (ethers.isAddress(contractFromUrl)) {
          contractAddress = contractFromUrl;
          console.log('Using contract address from URL:', contractAddress);
        } else {
          contractError = `Invalid contract address in URL: ${contractFromUrl}`;
          console.error(contractError);
        }
      } else if (window.__E2E_CONFIG__ && window.__E2E_CONFIG__.contractAddress) {
        contractAddress = window.__E2E_CONFIG__.contractAddress;
        console.log('Using E2E contract address:', contractAddress);
      } else if (
        network_obj &&
        network_obj.contract_addresses &&
        network_obj.contract_addresses['Conference']
      ) {
        contractAddress = network_obj.contract_addresses['Conference'];
        console.log('Using contract address from config:', contractAddress);
      } else if (process.env.CONTRACT_ADDRESS) {
        contractAddress = process.env.CONTRACT_ADDRESS;
        console.log('Using contract address from env:', contractAddress);
      }

      if (contractAddress) {
        // Create contract instance
        const contractRunner = signer || provider;
        contract = new ethers.Contract(contractAddress, ConferenceABI, contractRunner);
        console.log('Contract connected at:', contractAddress);
      } else if (!contractError) {
        contractError = 'No contract address provided. Add ?contract=0x... to the URL.';
        console.log(contractError);
      }
    } catch (e) {
      contractError = `Error connecting to contract: ${e.message}`;
      console.error('Error connecting to contract:', e);
    }

    // Find metadata for this contract
    let metadata = contractAddress
      ? Data.find(d => d.address?.toLowerCase() === contractAddress?.toLowerCase())
      : null;
    if (!metadata) {
      metadata = { ...Data[0], address: contractAddress || '0x000' };
    }

    window.contract = contract;
    window.provider = provider;
    window.signer = signer;
    const eventEmitter = EventEmitter();

    // Helper function to get balance using ethers
    async function getBalance(address) {
      try {
        const balance = await provider.getBalance(address);
        return balance;
      } catch (error) {
        console.error('Error getting balance:', error);
        return 0n;
      }
    }

    // Helper to convert BigInt to number safely
    function toNumber(value) {
      if (typeof value === 'bigint') {
        return Number(value);
      }
      if (value && typeof value.toNumber === 'function') {
        return value.toNumber();
      }
      return Number(value || 0);
    }

    // Functions to interact with contract
    async function getDetail() {
      if (!contract) return false;

      try {
        const [
          name,
          deposit,
          payoutVal,
          totalBalance,
          registered,
          attended,
          owner,
          ended,
          cancelled,
          limitOfParticipants,
          payoutAmount,
          admins,
        ] = await Promise.all([
          contract.name(),
          contract.deposit(),
          contract.payout(),
          contract.totalBalance(),
          contract.registered(),
          contract.attended(),
          contract.owner(),
          contract.ended(),
          contract.cancelled(),
          contract.limitOfParticipants(),
          contract.payoutAmount(),
          contract.getAdmins(),
        ]);

        const contractBalance = await getBalance(await contract.getAddress());

        const detail = {
          name,
          deposit,
          payout: payoutVal,
          totalBalance,
          registered,
          attended,
          owner,
          ended,
          cancelled,
          limitOfParticipants,
          payoutAmount,
          admins,
          contractBalance: parseFloat(ethers.formatEther(contractBalance)),
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
          if (toNumber(detail.registered) > 0) {
            detail.canAttend = true;
          }

          if (
            toNumber(detail.registered) > 0 &&
            toNumber(detail.attended) > 0 &&
            toNumber(detail.payout) > 0
          ) {
            detail.canPayback = true;
          }
          detail.canRegister = true;
          detail.canCancel = true;
          detail.canWithdraw = false;
        }

        detail.contractAddress = await contract.getAddress();
        window.detail = detail;
        eventEmitter.emit('detail', detail);
      } catch (error) {
        console.error('Error getting detail:', error);
      }
    }

    async function getParticipants(callback) {
      if (!contract) return false;

      try {
        const registeredCount = await contract.registered();
        const participantsArray = [];

        for (let i = 1; i <= toNumber(registeredCount); i++) {
          try {
            const address = await contract.participantsIndex(i);
            const participant = await contract.participants(address);

            const object = {
              name: participant[0],
              address: participant[1],
              attended: participant[2],
              paid: participant[3],
              ensname: null,
            };

            // Try to resolve ENS name (optional, fail silently)
            try {
              const ensName = await provider.lookupAddress(participant[1]);
              if (ensName) {
                object.ensname = ensName;
              }
            } catch {
              // ENS resolution failed, continue without it
            }

            participantsArray.push(object);
          } catch (error) {
            console.error(`Error fetching participant ${i}:`, error);
          }
        }

        if (participantsArray.length > 0) {
          eventEmitter.emit('participants_updated', participantsArray);
          window.participants = participantsArray.length;
          callback(participantsArray);
        }
      } catch (error) {
        console.error('Error getting participants:', error);
      }
    }

    window.eventEmitter = eventEmitter;

    async function action(name, address, args) {
      if (!contract || !signer) {
        eventEmitter.emit('notification', { status: 'error', message: 'No wallet connected' });
        return;
      }

      eventEmitter.emit('notification', { status: 'info', message: 'Requested' });

      try {
        const contractWithSigner = contract.connect(signer);

        let tx;
        const options = {};

        // Add value for registration
        if (name === 'register' || name === 'registerWithEncryption') {
          options.value = ethers.parseEther('0.02'); // 0.02 ETH deposit
        }

        // Call the appropriate contract method
        if (!args || args.length === 0) {
          tx = await contractWithSigner[name](options);
        } else if (args.length === 1) {
          tx = await contractWithSigner[name](args[0], options);
        } else {
          tx = await contractWithSigner[name](...args, options);
        }

        // Wait for transaction confirmation
        await tx.wait();

        eventEmitter.emit('notification', { status: 'success', message: 'Successfully Updated' });
        eventEmitter.emit('change');
        getDetail();
      } catch (error) {
        console.error('Transaction error:', error);
        const message = error.reason || error.message || 'Error has occurred';
        eventEmitter.emit('notification', { status: 'error', message });
      }
    }

    async function getAccounts() {
      if (read_only || !signer) {
        eventEmitter.emit('accounts_received', []);
        eventEmitter.emit('instruction');
        return false;
      }

      try {
        const address = await signer.getAddress();
        window.account = address;
        eventEmitter.emit('accounts_received', [address]);
      } catch (error) {
        console.error('Error getting accounts:', error);
        eventEmitter.emit('instruction');
      }
    }

    // Create an ethers-compatible wrapper for components expecting web3
    const ethersWrapper = {
      utils: {
        fromWei: (value, unit) => {
          if (unit === 'ether') {
            return ethers.formatEther(value);
          }
          return ethers.formatUnits(value, unit);
        },
        toWei: (value, unit) => {
          if (unit === 'ether') {
            return ethers.parseEther(value);
          }
          return ethers.parseUnits(value, unit);
        },
      },
      eth: {
        getBalance: async address => {
          return await provider.getBalance(address);
        },
        getAccounts: async () => {
          if (signer) {
            return [await signer.getAddress()];
          }
          return [];
        },
      },
    };

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

          {contractError ? (
            <Box
              className="container"
              sx={{
                textAlign: 'center',
                py: 8,
                px: 2,
              }}
            >
              <Typography variant="h5" color="error" gutterBottom>
                {contractError}
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>
                To view an event, add the contract address to the URL:
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  mt: 1,
                  fontFamily: 'monospace',
                  backgroundColor: '#f5f5f5',
                  p: 2,
                  borderRadius: 1,
                  display: 'inline-block',
                }}
              >
                {window.location.origin}
                {window.location.pathname}?contract=0x...
              </Typography>
            </Box>
          ) : (
            <>
              <Box className="container foo">
                <ConferenceDetail
                  eventEmitter={eventEmitter}
                  getDetail={getDetail}
                  web3={ethersWrapper}
                  contract={contract}
                  contractAddress={contractAddress}
                />
                <Participants
                  eventEmitter={eventEmitter}
                  getDetail={getDetail}
                  getParticipants={getParticipants}
                  getAccounts={getAccounts}
                  action={action}
                  web3={ethersWrapper}
                />
              </Box>
              <FormInput
                read_only={read_only}
                eventEmitter={eventEmitter}
                getAccounts={getAccounts}
                getDetail={getDetail}
                action={action}
              />
            </>
          )}
        </Box>
      </ThemeProvider>
    );

    const container = document.getElementById('app');
    const root = createRoot(container);
    root.render(<App />);

    window.getAccounts = getAccounts;

    // Initialize after a brief delay
    setTimeout(getAccounts, 100);
    setTimeout(getDetail, 100);

    // Logger functionality
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

    const startTime = new Date();
    const timer = setInterval(() => {
      const duration = new Date() - startTime;
      if ((window.detail && window.participants) || duration > 200000) {
        const obj = {
          action: 'load',
          user: window.account,
          participants: window.participants,
          contract: window.detail && window.detail.contractAddress,
          agent: navigator.userAgent,
          duration: duration,
          provider: 'ethers.js',
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
