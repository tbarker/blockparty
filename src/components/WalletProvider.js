/**
 * WalletProvider - Wraps the app with RainbowKit and wagmi providers
 *
 * This component provides wallet connection functionality via RainbowKit,
 * supporting multiple wallets (MetaMask, WalletConnect, Coinbase, Rainbow, etc.)
 */

import '@rainbow-me/rainbowkit/styles.css';
import React from 'react';
import { RainbowKitProvider, lightTheme } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { config } from '../config/wagmi';

// Create a React Query client for caching
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache wallet/chain data for 4 seconds
      staleTime: 4000,
      // Keep in cache for 10 minutes
      gcTime: 600000,
    },
  },
});

// Custom theme to match Block Party's style
const blockPartyTheme = lightTheme({
  accentColor: '#607D8B', // Block Party primary color
  accentColorForeground: 'white',
  borderRadius: 'medium',
  fontStack: 'system',
});

/**
 * WalletProvider component
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Child components
 * @returns {React.ReactElement}
 */
export function WalletProvider({ children }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={blockPartyTheme} modalSize="compact">
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default WalletProvider;
