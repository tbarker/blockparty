/**
 * Smoke tests for Participants component
 */

import React from 'react';
import Participants from '../../components/Participants';
import {
  renderWithProviders,
  createMockEventEmitter,
  createMockWeb3,
  createMockDetail,
  createMockParticipant,
  waitForAsync,
} from '../testUtils';

describe('Participants', () => {
  let eventEmitter;
  let web3;
  let mockGetDetail;
  let mockGetParticipants;
  let mockGetAccounts;
  let mockAction;
  let originalWeb3;

  beforeEach(() => {
    eventEmitter = createMockEventEmitter();
    web3 = createMockWeb3();
    mockGetDetail = jest.fn();
    mockGetParticipants = jest.fn((callback) => callback([]));
    mockGetAccounts = jest.fn();
    mockAction = jest.fn();

    // Save original and set up global web3 mock with all required properties
    originalWeb3 = global.web3;
    global.web3 = {
      currentProvider: {
        constructor: { name: 'MockProvider' },
        scanQRCode: null,
      },
      fromWei: jest.fn((val) => {
        if (typeof val === 'object' && val.toNumber) {
          val = val.toNumber();
        }
        if (typeof val === 'number') return (val / 1e18).toString();
        return '0';
      }),
    };
  });

  afterEach(() => {
    global.web3 = originalWeb3;
  });

  it('renders without crashing', () => {
    const { container } = renderWithProviders(
      <Participants
        eventEmitter={eventEmitter}
        getDetail={mockGetDetail}
        getParticipants={mockGetParticipants}
        getAccounts={mockGetAccounts}
        action={mockAction}
        web3={web3}
      />
    );

    expect(container).toBeInTheDocument();
  });

  it('displays Participants header', () => {
    const { getByText } = renderWithProviders(
      <Participants
        eventEmitter={eventEmitter}
        getDetail={mockGetDetail}
        getParticipants={mockGetParticipants}
        getAccounts={mockGetAccounts}
        action={mockAction}
        web3={web3}
      />
    );

    expect(getByText('Participants')).toBeInTheDocument();
  });

  it('displays table headers', () => {
    const { getByText } = renderWithProviders(
      <Participants
        eventEmitter={eventEmitter}
        getDetail={mockGetDetail}
        getParticipants={mockGetParticipants}
        getAccounts={mockGetAccounts}
        action={mockAction}
        web3={web3}
      />
    );

    expect(getByText('Name')).toBeInTheDocument();
    expect(getByText('Attended')).toBeInTheDocument();
    expect(getByText('Payout')).toBeInTheDocument();
  });

  it('shows empty state when no participants', async () => {
    mockGetParticipants = jest.fn((callback) => callback([]));

    const { getByText } = renderWithProviders(
      <Participants
        eventEmitter={eventEmitter}
        getDetail={mockGetDetail}
        getParticipants={mockGetParticipants}
        getAccounts={mockGetAccounts}
        action={mockAction}
        web3={web3}
      />
    );

    // Emit detail to trigger render wrapped in act
    await eventEmitter.emitAsync('detail', createMockDetail({ name: 'Test Event' }));
    await waitForAsync();

    expect(getByText(/No one has registered yet/)).toBeInTheDocument();
  });

  it('displays participant list when participants exist', async () => {
    const participants = [
      createMockParticipant({ name: '@testuser1', address: '0x1111' }),
      createMockParticipant({ name: '@testuser2', address: '0x2222' }),
    ];

    mockGetParticipants = jest.fn((callback) => callback(participants));

    const { getByText } = renderWithProviders(
      <Participants
        eventEmitter={eventEmitter}
        getDetail={mockGetDetail}
        getParticipants={mockGetParticipants}
        getAccounts={mockGetAccounts}
        action={mockAction}
        web3={web3}
      />
    );

    // Emit detail and participants wrapped in act
    await eventEmitter.emitAsync('detail', createMockDetail({ name: 'Test Event', admins: [] }));
    await eventEmitter.emitAsync('participants_updated', participants);
    await waitForAsync();

    expect(getByText(/@testuser1/)).toBeInTheDocument();
    expect(getByText(/@testuser2/)).toBeInTheDocument();
  });

  it('shows Yes for attended participants', async () => {
    const participants = [
      createMockParticipant({ name: '@attended', address: '0x1111', attended: true }),
    ];

    mockGetParticipants = jest.fn((callback) => callback(participants));

    const { getByText } = renderWithProviders(
      <Participants
        eventEmitter={eventEmitter}
        getDetail={mockGetDetail}
        getParticipants={mockGetParticipants}
        getAccounts={mockGetAccounts}
        action={mockAction}
        web3={web3}
      />
    );

    // Emit detail and participants wrapped in act
    await eventEmitter.emitAsync('detail', createMockDetail({ name: 'Test Event', admins: [] }));
    await eventEmitter.emitAsync('participants_updated', participants);
    await eventEmitter.emitAsync('accounts_received', ['0x0000']);
    await waitForAsync();

    expect(getByText('Yes')).toBeInTheDocument();
  });

  it('filters participants by search keyword', async () => {
    const participants = [
      createMockParticipant({ name: '@findme', address: '0x1111' }),
      createMockParticipant({ name: '@hideme', address: '0x2222' }),
    ];

    mockGetParticipants = jest.fn((callback) => callback(participants));

    const { getByText, queryByText } = renderWithProviders(
      <Participants
        eventEmitter={eventEmitter}
        getDetail={mockGetDetail}
        getParticipants={mockGetParticipants}
        getAccounts={mockGetAccounts}
        action={mockAction}
        web3={web3}
      />
    );

    // Emit detail and participants wrapped in act
    await eventEmitter.emitAsync('detail', createMockDetail({ name: 'Test Event', admins: [] }));
    await eventEmitter.emitAsync('participants_updated', participants);
    await eventEmitter.emitAsync('accounts_received', ['0x0000']);
    await waitForAsync();

    // Both should be visible initially
    expect(getByText(/@findme/)).toBeInTheDocument();
    expect(getByText(/@hideme/)).toBeInTheDocument();

    // Emit search event wrapped in act
    await eventEmitter.emitAsync('search', 'findme');
    await waitForAsync();

    // After search, only matching should be visible (hideme has display:none)
    expect(getByText(/@findme/)).toBeVisible();
  });

  it('shows admin note at bottom', () => {
    const { getByText } = renderWithProviders(
      <Participants
        eventEmitter={eventEmitter}
        getDetail={mockGetDetail}
        getParticipants={mockGetParticipants}
        getAccounts={mockGetAccounts}
        action={mockAction}
        web3={web3}
      />
    );

    expect(getByText(/admins are marked as/)).toBeInTheDocument();
  });
});
