/**
 * Ethers.js v6 adapters for wagmi
 *
 * These functions convert wagmi wallet clients to ethers.js providers and signers,
 * allowing existing ethers.js contract code to work with RainbowKit/wagmi wallet connections.
 *
 * Based on: https://wagmi.sh/react/guides/ethers
 */

import { useMemo } from 'react';
import { useClient, useConnectorClient } from 'wagmi';
import { BrowserProvider, JsonRpcSigner, FallbackProvider, JsonRpcProvider } from 'ethers';

/**
 * Convert a wagmi Client to an ethers.js Provider
 * @param {Object} client - wagmi Client
 * @returns {BrowserProvider|FallbackProvider|JsonRpcProvider} ethers.js Provider
 */
export function clientToProvider(client) {
  const { chain, transport } = client;

  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address,
  };

  if (transport.type === 'fallback') {
    const providers = transport.transports.map(({ value }) => new JsonRpcProvider(value?.url, network));
    if (providers.length === 1) return providers[0];
    return new FallbackProvider(providers);
  }

  // For WebSocket or HTTP transports
  if (transport.url) {
    return new JsonRpcProvider(transport.url, network);
  }

  // Fallback to BrowserProvider using the transport request function
  return new BrowserProvider(transport, network);
}

/**
 * Convert a wagmi ConnectorClient to an ethers.js Signer
 * @param {Object} client - wagmi ConnectorClient
 * @returns {JsonRpcSigner} ethers.js Signer
 */
export function clientToSigner(client) {
  const { account, chain, transport } = client;

  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address,
  };

  const provider = new BrowserProvider(transport, network);
  const signer = new JsonRpcSigner(provider, account.address);

  return signer;
}

/**
 * React hook to get an ethers.js Provider from the current wagmi connection
 * @param {Object} options - Optional configuration { chainId }
 * @returns {BrowserProvider|FallbackProvider|JsonRpcProvider|undefined} ethers.js Provider or undefined
 */
export function useEthersProvider({ chainId } = {}) {
  const client = useClient({ chainId });

  return useMemo(() => {
    if (!client) return undefined;
    return clientToProvider(client);
  }, [client]);
}

/**
 * React hook to get an ethers.js Signer from the current wagmi wallet connection
 * @param {Object} options - Optional configuration { chainId }
 * @returns {JsonRpcSigner|undefined} ethers.js Signer or undefined
 */
export function useEthersSigner({ chainId } = {}) {
  const { data: client } = useConnectorClient({ chainId });

  return useMemo(() => {
    if (!client) return undefined;
    return clientToSigner(client);
  }, [client]);
}
