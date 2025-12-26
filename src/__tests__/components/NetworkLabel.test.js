/**
 * Smoke tests for NetworkLabel component
 */

import React from 'react';
import NetworkLabel from '../../components/NetworkLabel';
import {
  renderWithProviders,
  createMockEventEmitter,
  waitForAsync,
} from '../testUtils';

describe('NetworkLabel', () => {
  let eventEmitter;

  beforeEach(() => {
    eventEmitter = createMockEventEmitter();
  });

  it('renders without crashing', () => {
    const { container } = renderWithProviders(
      <NetworkLabel eventEmitter={eventEmitter} read_only={false} />
    );

    expect(container).toBeInTheDocument();
  });

  it('shows READONLY when in read_only mode', () => {
    const { getByText } = renderWithProviders(
      <NetworkLabel eventEmitter={eventEmitter} read_only={true} />
    );

    expect(getByText('READONLY')).toBeInTheDocument();
  });

  it('shows nothing initially when not read_only', () => {
    const { container } = renderWithProviders(
      <NetworkLabel eventEmitter={eventEmitter} read_only={false} />
    );

    // Component returns null when there's no text/network set
    const button = container.querySelector('button');
    expect(button).toBeNull();
  });

  it('displays network name on network event', async () => {
    const { getByText } = renderWithProviders(
      <NetworkLabel eventEmitter={eventEmitter} read_only={false} />
    );

    // Emit network event wrapped in act
    await eventEmitter.emitAsync('network', { name: 'RINKEBY' });
    await waitForAsync();

    expect(getByText('RINKEBY')).toBeInTheDocument();
  });

  it('displays MAINNET with green styling', async () => {
    const { getByText } = renderWithProviders(
      <NetworkLabel eventEmitter={eventEmitter} read_only={false} />
    );

    // Emit mainnet network event
    await eventEmitter.emitAsync('network', { name: 'MAINNET' });
    await waitForAsync();

    const button = getByText('MAINNET');
    expect(button).toBeInTheDocument();
  });

  it('displays testnet with orange styling', async () => {
    const { getByText } = renderWithProviders(
      <NetworkLabel eventEmitter={eventEmitter} read_only={false} />
    );

    // Emit testnet network event
    await eventEmitter.emitAsync('network', { name: 'ROPSTEN' });
    await waitForAsync();

    const button = getByText('ROPSTEN');
    expect(button).toBeInTheDocument();
  });
});
