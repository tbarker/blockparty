import './stylesheets/app.css';
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import EventEmitter from 'event-emitter';
import { createRoot } from 'react-dom/client';
import { ethers } from 'ethers';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';

// RainbowKit/wagmi integration
import WalletProvider from './components/WalletProvider';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useEthersProvider, useEthersSigner } from './util/ethersAdapter';
import { anvilChain } from './config/wagmi';

// Use Forge output for contract ABI
import ConferenceArtifact from '../out/Conference.sol/Conference.json';
import ConferenceFactoryArtifact from '../out/ConferenceFactory.sol/ConferenceFactory.json';
import ConferenceDetail from './components/ConferenceDetail';
import FormInput from './components/FormInput';
import Notification from './components/Notification';
import Instruction from './components/Instruction';
import Participants from './components/Participants';
import NetworkLabel from './components/NetworkLabel';
import NewEventDialog from './components/NewEventDialog';
import { getArweaveMetadata, clearMetadataCache, resetRetryState } from './util/arweaveMetadata';

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

// Contract ABIs from Forge output
const ConferenceABI = ConferenceArtifact.abi;
const ConferenceFactoryABI = ConferenceFactoryArtifact.abi;

// Create a shared event emitter instance
const eventEmitter = EventEmitter();
window.eventEmitter = eventEmitter;

/**
 * Get network configuration based on chain ID
 */
function getNetworkConfig(chainId) {
  let env;
  switch (chainId?.toString()) {
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

  return require('../app_config.js')[env] || require('../app_config.js')['development'];
}

/**
 * Helper to convert BigInt to number safely
 */
function toNumber(value) {
  if (typeof value === 'bigint') {
    return Number(value);
  }
  if (value && typeof value.toNumber === 'function') {
    return value.toNumber();
  }
  return Number(value || 0);
}

/**
 * Create an ethers-compatible wrapper for components expecting web3
 */
function createEthersWrapper(provider) {
  return {
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
        if (provider) {
          return await provider.getBalance(address);
        }
        return 0n;
      },
      getAccounts: async () => {
        // This is now handled by wagmi useAccount
        return [];
      },
    },
  };
}

/**
 * Main BlockParty App component
 * Uses wagmi hooks for wallet connection and bridges to existing event-emitter pattern
 */
function BlockPartyApp() {
  const [showNewEventDialog, setShowNewEventDialog] = useState(false);
  const [contract, setContract] = useState(null);
  const [factory, setFactory] = useState(null);
  const [factoryAvailable, setFactoryAvailable] = useState(false);
  const [contractAddress, setContractAddress] = useState(null);
  const [contractError, setContractError] = useState(null);
  const [networkObj, setNetworkObj] = useState(null);
  const [_arweaveMetadata, setArweaveMetadata] = useState(null);

  // Wagmi hooks for wallet connection
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  // Get ethers provider and signer from wagmi
  const provider = useEthersProvider({ chainId });
  const signer = useEthersSigner({ chainId });

  // Determine if we're in read-only mode
  const readOnly = !isConnected || !signer;

  // Refs for stable references in callbacks
  const contractRef = useRef(null);
  const arweaveMetadataRef = useRef(null);

  // Create ethers wrapper
  const ethersWrapper = useMemo(() => createEthersWrapper(provider), [provider]);

  // Helper function to get balance
  const getBalance = useCallback(
    async addr => {
      if (!provider) return 0n;
      try {
        return await provider.getBalance(addr);
      } catch (error) {
        console.error('Error getting balance:', error);
        return 0n;
      }
    },
    [provider]
  );

  // Ensure correct network for local development
  useEffect(() => {
    async function ensureCorrectNetwork() {
      const isLocalDev = window.location.hostname === 'localhost';
      if (!isLocalDev || !isConnected || !chainId) return;

      if (chainId !== anvilChain.id) {
        console.log(`Local dev detected: switching from chain ${chainId} to Anvil (${anvilChain.id})`);
        try {
          switchChain({ chainId: anvilChain.id });
        } catch (error) {
          console.error('Failed to switch network:', error);
        }
      }
    }

    ensureCorrectNetwork();
  }, [isConnected, chainId, switchChain]);

  // Setup network config and emit network event
  useEffect(() => {
    if (chainId) {
      const config = getNetworkConfig(chainId);
      setNetworkObj(config);
      eventEmitter.emit('network', config);

      // Auto-enable Turbo devnet mode for local development
      if (chainId === 1337) {
        if (typeof window !== 'undefined' && window.localStorage) {
          if (window.localStorage.getItem('turbo_devnet') === null) {
            window.localStorage.setItem('turbo_devnet', 'true');
            console.log('Auto-enabled Arweave devnet mode for local development');
          }
        }
      }
    }
  }, [chainId]);

  // Emit accounts when wallet connects/disconnects
  useEffect(() => {
    if (isConnected && address) {
      window.account = address;
      eventEmitter.emit('accounts_received', [address]);
    } else {
      window.account = null;
      eventEmitter.emit('accounts_received', []);
      // Note: With RainbowKit, we don't auto-show the instruction modal.
      // Users can click "About" to see it, and the Connect Wallet button is self-explanatory.
    }
  }, [isConnected, address]);

  // Initialize contract when provider/signer changes
  useEffect(() => {
    if (!provider || !networkObj) return;

    let contractAddr = null;
    let error = null;

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
        if (ethers.isAddress(contractFromUrl)) {
          contractAddr = contractFromUrl;
          console.log('Using contract address from URL:', contractAddr);
        } else {
          error = `Invalid contract address in URL: ${contractFromUrl}`;
          console.error(error);
        }
      } else if (window.__E2E_CONFIG__ && window.__E2E_CONFIG__.contractAddress) {
        contractAddr = window.__E2E_CONFIG__.contractAddress;
        console.log('Using E2E contract address:', contractAddr);
      } else if (networkObj?.contract_addresses?.Conference) {
        contractAddr = networkObj.contract_addresses.Conference;
        console.log('Using contract address from config:', contractAddr);
      } else if (process.env.CONTRACT_ADDRESS) {
        contractAddr = process.env.CONTRACT_ADDRESS;
        console.log('Using contract address from env:', contractAddr);
      }

      if (contractAddr) {
        const contractRunner = signer || provider;
        const newContract = new ethers.Contract(contractAddr, ConferenceABI, contractRunner);
        setContract(newContract);
        contractRef.current = newContract;
        window.contract = newContract;
        console.log('Contract connected at:', contractAddr);
      } else if (!error) {
        error = 'No contract address provided. Add ?contract=0x... to the URL.';
        console.log(error);
      }

      setContractAddress(contractAddr);
      setContractError(error);
    } catch (e) {
      setContractError(`Error connecting to contract: ${e.message}`);
      console.error('Error connecting to contract:', e);
    }

    // Factory contract setup
    const factoryAddress =
      networkObj?.factory_address ||
      process.env.FACTORY_ADDRESS ||
      (window.__E2E_CONFIG__ && window.__E2E_CONFIG__.factoryAddress);

    if (factoryAddress && ethers.isAddress(factoryAddress)) {
      try {
        const factoryRunner = signer || provider;
        const newFactory = new ethers.Contract(factoryAddress, ConferenceFactoryABI, factoryRunner);
        setFactory(newFactory);
        setFactoryAvailable(true);
        window.factory = newFactory;
        console.log('Factory connected at:', factoryAddress);
      } catch (e) {
        console.error('Error connecting to factory:', e);
      }
    } else {
      console.log('No factory address configured');
    }

    window.provider = provider;
    window.signer = signer;
  }, [provider, signer, networkObj]);

  // getDetail function
  const getDetail = useCallback(async () => {
    const currentContract = contractRef.current;
    if (!currentContract) return false;

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
        metadataUri,
      ] = await Promise.all([
        currentContract.name(),
        currentContract.deposit(),
        currentContract.payout(),
        currentContract.totalBalance(),
        currentContract.registered(),
        currentContract.attended(),
        currentContract.owner(),
        currentContract.ended(),
        currentContract.cancelled(),
        currentContract.limitOfParticipants(),
        currentContract.payoutAmount(),
        currentContract.getAdmins(),
        currentContract.metadataUri().catch(() => ''),
      ]);

      // Fetch metadata from Arweave if URI is set
      let metadata = arweaveMetadataRef.current;
      if (metadataUri && !metadata) {
        console.log('Fetching metadata from Arweave:', metadataUri);
        metadata = await getArweaveMetadata(metadataUri);
        if (metadata) {
          console.log('Loaded Arweave metadata:', metadata);
          arweaveMetadataRef.current = metadata;
          setArweaveMetadata(metadata);
        } else {
          console.log('Arweave metadata not yet available for:', metadataUri);
        }
      }

      const contractBalance = await getBalance(await currentContract.getAddress());
      const metadataPending = !!(metadataUri && !metadata);

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
        metadataUri,
        metadataPending,
        date: metadata?.date || null,
        map_url: metadata?.map_url || null,
        location_text: metadata?.location_text || null,
        description_text: metadata?.description_text || null,
        images: metadata?.images || null,
        links: metadata?.links || null,
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

      detail.contractAddress = await currentContract.getAddress();
      window.detail = detail;
      eventEmitter.emit('detail', detail);

      if (detail.metadataPending) {
        console.log('Metadata pending, scheduling retry in 3 seconds...');
        setTimeout(() => {
          resetRetryState(metadataUri);
          arweaveMetadataRef.current = null;
          setArweaveMetadata(null);
          getDetail();
        }, 3000);
      }
    } catch (error) {
      console.error('Error getting detail:', error);
    }
  }, [getBalance]);

  // getParticipants function
  const getParticipants = useCallback(
    async callback => {
      const currentContract = contractRef.current;
      if (!currentContract || !provider) return false;

      try {
        const registeredCount = await currentContract.registered();
        const participantsArray = [];

        for (let i = 1; i <= toNumber(registeredCount); i++) {
          try {
            const participantAddress = await currentContract.participantsIndex(i);
            const participant = await currentContract.participants(participantAddress);

            const object = {
              name: participant[0],
              address: participant[1],
              attended: participant[2],
              paid: participant[3],
              ensname: null,
            };

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
    },
    [provider]
  );

  // action function for contract interactions
  const action = useCallback(
    async (name, addr, args) => {
      const currentContract = contractRef.current;
      if (!currentContract || !signer) {
        eventEmitter.emit('notification', { status: 'error', message: 'No wallet connected' });
        return;
      }

      eventEmitter.emit('notification', { status: 'info', message: 'Requested' });

      try {
        const contractWithSigner = currentContract.connect(signer);
        let tx;
        const options = {};

        if (name === 'register' || name === 'registerWithEncryption') {
          // Use the actual deposit amount from the contract
          const depositAmount = await currentContract.deposit();
          options.value = depositAmount;
        }

        if (!args || args.length === 0) {
          tx = await contractWithSigner[name](options);
        } else if (args.length === 1) {
          tx = await contractWithSigner[name](args[0], options);
        } else {
          tx = await contractWithSigner[name](...args, options);
        }

        await tx.wait();

        eventEmitter.emit('notification', { status: 'success', message: 'Successfully Updated' });
        eventEmitter.emit('change');
        getDetail();
      } catch (error) {
        console.error('Transaction error:', error);
        const message = error.reason || error.message || 'Error has occurred';
        eventEmitter.emit('notification', { status: 'error', message });
      }
    },
    [signer, getDetail]
  );

  // getAccounts - now bridges wagmi state to event emitter
  const getAccounts = useCallback(() => {
    if (readOnly || !address) {
      eventEmitter.emit('accounts_received', []);
      return false;
    }
    eventEmitter.emit('accounts_received', [address]);
  }, [readOnly, address]);

  // updateMetadataUri handler
  const updateMetadataUri = useCallback(
    async newUri => {
      const currentContract = contractRef.current;
      if (!currentContract || !signer) {
        eventEmitter.emit('notification', { status: 'error', message: 'No wallet connected' });
        throw new Error('No wallet connected');
      }

      eventEmitter.emit('notification', { status: 'info', message: 'Updating metadata...' });

      try {
        const contractWithSigner = currentContract.connect(signer);
        const tx = await contractWithSigner.setMetadataUri(newUri);
        await tx.wait();

        clearMetadataCache();
        arweaveMetadataRef.current = null;
        setArweaveMetadata(null);

        eventEmitter.emit('notification', { status: 'success', message: 'Metadata updated successfully!' });
        eventEmitter.emit('change');

        await getDetail();
      } catch (error) {
        console.error('Error updating metadata:', error);
        const message = error.reason || error.message || 'Failed to update metadata';
        eventEmitter.emit('notification', { status: 'error', message });
        throw error;
      }
    },
    [signer, getDetail]
  );

  // createConference handler
  const createConference = useCallback(
    async params => {
      if (!factory || !signer) {
        throw new Error('Factory not available or no wallet connected');
      }

      const factoryWithSigner = factory.connect(signer);
      const depositWei = ethers.parseEther(params.deposit);

      console.log('Creating conference with params:', {
        name: params.name,
        deposit: depositWei.toString(),
        limitOfParticipants: params.limitOfParticipants,
        coolingPeriod: params.coolingPeriod,
        metadataUri: params.metadataUri,
      });

      const tx = await factoryWithSigner.createConference(
        params.name,
        depositWei,
        params.limitOfParticipants,
        params.coolingPeriod,
        params.metadataUri || ''
      );

      const receipt = await tx.wait();

      const conferenceCreatedEvent = receipt.logs.find(log => {
        try {
          const parsed = factory.interface.parseLog({ topics: log.topics, data: log.data });
          return parsed && parsed.name === 'ConferenceCreated';
        } catch {
          return false;
        }
      });

      if (conferenceCreatedEvent) {
        const parsed = factory.interface.parseLog({
          topics: conferenceCreatedEvent.topics,
          data: conferenceCreatedEvent.data,
        });
        const newAddress = parsed.args.conferenceProxy || parsed.args[0];
        console.log('New conference created at:', newAddress);
        return newAddress;
      }

      const conferenceCount = await factory.conferenceCount();
      const newAddress = await factory.conferences(conferenceCount - 1n);
      console.log('New conference created at (fallback):', newAddress);
      return newAddress;
    },
    [factory, signer]
  );

  // Setup event listeners
  useEffect(() => {
    eventEmitter.on('updateMetadataUri', updateMetadataUri);

    return () => {
      eventEmitter.off('updateMetadataUri', updateMetadataUri);
    };
  }, [updateMetadataUri]);

  // Initialize data on contract ready
  useEffect(() => {
    if (contract) {
      contractRef.current = contract;
      window.getAccounts = getAccounts;

      setTimeout(getAccounts, 100);
      setTimeout(getDetail, 100);

      // Logger functionality
      const loggerHandler = payload => {
        fetch('http://localhost:5000/log', {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          method: 'POST',
          body: JSON.stringify(payload),
        }).catch(() => {});
        console.log('logger', payload);
      };

      eventEmitter.on('logger', loggerHandler);

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

      return () => {
        clearInterval(timer);
      };
    }
  }, [contract, getAccounts, getDetail]);

  return (
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
              <Typography component="span" sx={{ fontSize: 'small', fontFamily: 'sans-serif', ml: 1 }}>
                - NO BLOCK NO PARTY -
              </Typography>
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <NetworkLabel eventEmitter={eventEmitter} read_only={readOnly} chainId={chainId} />
              {!readOnly && (
                <Button
                  variant="outlined"
                  sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.5)' }}
                  onClick={() => setShowNewEventDialog(true)}
                >
                  + New Event
                </Button>
              )}
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
            {readOnly && factoryAvailable && (
              <Box sx={{ mt: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <Typography variant="body1" color="text.secondary">
                  Connect your wallet to create a new event:
                </Typography>
                <ConnectButton />
              </Box>
            )}
            {!readOnly && factoryAvailable && (
              <Box sx={{ mt: 4 }}>
                <Typography variant="body1" color="text.secondary" gutterBottom>
                  Or create a new event:
                </Typography>
                <Button variant="contained" onClick={() => setShowNewEventDialog(true)} sx={{ mt: 1 }}>
                  + Create New Event
                </Button>
              </Box>
            )}
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
              read_only={readOnly}
              eventEmitter={eventEmitter}
              getAccounts={getAccounts}
              getDetail={getDetail}
              action={action}
              provider={provider}
            />
          </>
        )}

        {/* New Event Dialog */}
        <NewEventDialog
          open={showNewEventDialog}
          onClose={() => setShowNewEventDialog(false)}
          provider={provider}
          networkId={chainId?.toString()}
          onCreateEvent={createConference}
          factoryAvailable={factoryAvailable}
        />
      </Box>
    </ThemeProvider>
  );
}

/**
 * Root App component that wraps BlockPartyApp with WalletProvider
 */
function App() {
  return (
    <WalletProvider>
      <BlockPartyApp />
    </WalletProvider>
  );
}

// Mount the app
window.onload = function () {
  const container = document.getElementById('app');
  const root = createRoot(container);
  root.render(<App />);
};
