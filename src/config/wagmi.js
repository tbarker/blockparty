import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { mainnet, sepolia } from 'wagmi/chains';

// Custom chain for local Anvil development
export const anvilChain = {
  id: 1337,
  name: 'Localhost',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['http://localhost:8545'] },
  },
  testnet: true,
};

// WalletConnect projectId - get one from https://cloud.walletconnect.com
// For development/testing, a placeholder is used (will show warning but work for injected wallets)
const WALLETCONNECT_PROJECT_ID =
  process.env.WALLETCONNECT_PROJECT_ID || 'YOUR_WALLETCONNECT_PROJECT_ID';

// Check if running in local development (safely handles SSR/test environments)
function isLocalDev() {
  if (typeof window === 'undefined') return false;
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

// All supported chains - order determines default chain selection
// In local dev, Anvil is first; in production, mainnet is first
export const chains = isLocalDev()
  ? [anvilChain, sepolia, mainnet]
  : [mainnet, sepolia, anvilChain];

export const config = getDefaultConfig({
  appName: 'Block Party',
  projectId: WALLETCONNECT_PROJECT_ID,
  chains: chains,
  ssr: false, // Not using server-side rendering
});
