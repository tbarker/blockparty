/**
 * Smoke tests for ConferenceDetail component
 */

import React from 'react';
import ConferenceDetail from '../../components/ConferenceDetail';
import {
  renderWithProviders,
  createMockEventEmitter,
  createMockWeb3,
  createMockDetail,
  waitForAsync,
} from '../testUtils';

describe('ConferenceDetail', () => {
  let eventEmitter;
  let web3;
  let mockGetDetail;

  beforeEach(() => {
    eventEmitter = createMockEventEmitter();
    web3 = createMockWeb3();
    mockGetDetail = jest.fn();
  });

  it('renders without crashing', () => {
    const { container } = renderWithProviders(
      <ConferenceDetail
        eventEmitter={eventEmitter}
        getDetail={mockGetDetail}
        web3={web3}
        contract={null}
        contractAddress="0x1234567890123456789012345678901234567890"
      />
    );

    expect(container).toBeInTheDocument();
  });

  it('displays Event Info header', () => {
    const { getByText } = renderWithProviders(
      <ConferenceDetail
        eventEmitter={eventEmitter}
        getDetail={mockGetDetail}
        web3={web3}
        contract={null}
        contractAddress="0x1234567890123456789012345678901234567890"
      />
    );

    expect(getByText('Event Info')).toBeInTheDocument();
  });

  it('displays event details when data is emitted', async () => {
    const { getByText } = renderWithProviders(
      <ConferenceDetail
        eventEmitter={eventEmitter}
        getDetail={mockGetDetail}
        web3={web3}
        contract={null}
        contractAddress="0x1234567890123456789012345678901234567890"
      />
    );

    // Emit detail event wrapped in act
    const mockDetail = createMockDetail({ name: 'Test Conference' });
    await eventEmitter.emitAsync('detail', mockDetail);
    await waitForAsync();

    expect(getByText(/Test Conference/)).toBeInTheDocument();
  });

  it('displays deposit information', async () => {
    const { getByText } = renderWithProviders(
      <ConferenceDetail
        eventEmitter={eventEmitter}
        getDetail={mockGetDetail}
        web3={web3}
        contract={null}
        contractAddress="0x1234567890123456789012345678901234567890"
      />
    );

    // Emit detail event
    const mockDetail = createMockDetail();
    await eventEmitter.emitAsync('detail', mockDetail);
    await waitForAsync();

    expect(getByText(/Deposit/)).toBeInTheDocument();
  });

  it('shows participant count', async () => {
    const { getByText } = renderWithProviders(
      <ConferenceDetail
        eventEmitter={eventEmitter}
        getDetail={mockGetDetail}
        web3={web3}
        contract={null}
        contractAddress="0x1234567890123456789012345678901234567890"
      />
    );

    // Emit detail with registered participants
    const mockDetail = createMockDetail({
      registered: { toNumber: () => 10 },
      limitOfParticipants: { toNumber: () => 20 },
    });
    await eventEmitter.emitAsync('detail', mockDetail);
    await waitForAsync();

    // Should show "Going (spots left)" with count
    expect(getByText(/Going/)).toBeInTheDocument();
  });

  it('shows attended count when event has ended', async () => {
    const { getByText } = renderWithProviders(
      <ConferenceDetail
        eventEmitter={eventEmitter}
        getDetail={mockGetDetail}
        web3={web3}
        contract={null}
        contractAddress="0x1234567890123456789012345678901234567890"
      />
    );

    // Emit detail for ended event
    const mockDetail = createMockDetail({
      ended: true,
      attended: { toNumber: () => 8 },
    });
    await eventEmitter.emitAsync('detail', mockDetail);
    await waitForAsync();

    expect(getByText(/Attended/)).toBeInTheDocument();
  });

  it('displays location information', async () => {
    const { getByText } = renderWithProviders(
      <ConferenceDetail
        eventEmitter={eventEmitter}
        getDetail={mockGetDetail}
        web3={web3}
        contract={null}
        contractAddress="0x1234567890123456789012345678901234567890"
      />
    );

    expect(getByText(/Location/)).toBeInTheDocument();
  });

  it('displays date information', async () => {
    const { getByText } = renderWithProviders(
      <ConferenceDetail
        eventEmitter={eventEmitter}
        getDetail={mockGetDetail}
        web3={web3}
        contract={null}
        contractAddress="0x1234567890123456789012345678901234567890"
      />
    );

    expect(getByText(/Date/)).toBeInTheDocument();
  });

  it('handles undefined contractAddress gracefully', () => {
    // This test ensures the component doesn't crash when contractAddress is undefined
    // This can happen during initial load before the contract is resolved
    const { container } = renderWithProviders(
      <ConferenceDetail
        eventEmitter={eventEmitter}
        getDetail={mockGetDetail}
        web3={web3}
        contract={null}
        contractAddress={undefined}
      />
    );

    expect(container).toBeInTheDocument();
  });

  it('handles null props gracefully', () => {
    // Test that component handles various null/undefined props without crashing
    const { container } = renderWithProviders(
      <ConferenceDetail
        eventEmitter={eventEmitter}
        getDetail={mockGetDetail}
        web3={web3}
        contract={null}
        contractAddress={null}
      />
    );

    expect(container).toBeInTheDocument();
  });
});
