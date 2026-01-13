/**
 * Smoke tests for FormInput component
 */

import React from 'react';
import FormInput from '../../components/FormInput';
import {
  renderWithProviders,
  createMockEventEmitter,
  createMockDetail,
  waitForAsync,
} from '../testUtils';

describe('FormInput', () => {
  let eventEmitter;
  let mockAction;
  let mockGetAccounts;
  let mockGetDetail;

  beforeEach(() => {
    eventEmitter = createMockEventEmitter();
    mockAction = jest.fn();
    mockGetAccounts = jest.fn();
    mockGetDetail = jest.fn();

    // Set up global web3 mock (used by component)
    global.web3 = {
      currentProvider: { constructor: { name: 'MockProvider' } },
      fromWei: jest.fn((val) => (parseFloat(val) / 1e18).toString()),
    };
  });

  afterEach(() => {
    delete global.web3;
  });

  it('renders without crashing', () => {
    const { container } = renderWithProviders(
      <FormInput
        eventEmitter={eventEmitter}
        action={mockAction}
        getAccounts={mockGetAccounts}
        getDetail={mockGetDetail}
        read_only={false}
      />
    );

    expect(container).toBeInTheDocument();
  });

  it('shows read-only message when in read_only mode', () => {
    const { getByText } = renderWithProviders(
      <FormInput
        eventEmitter={eventEmitter}
        action={mockAction}
        getAccounts={mockGetAccounts}
        getDetail={mockGetDetail}
        read_only={true}
      />
    );

    expect(getByText(/Connect your wallet to register/)).toBeInTheDocument();
  });

  it('shows Connect Wallet button (RainbowKit)', async () => {
    const { getByTestId } = renderWithProviders(
      <FormInput
        eventEmitter={eventEmitter}
        action={mockAction}
        getAccounts={mockGetAccounts}
        getDetail={mockGetDetail}
        read_only={false}
      />
    );

    // Emit accounts wrapped in act
    await eventEmitter.emitAsync('accounts_received', ['0x1234567890123456789012345678901234567890']);
    await eventEmitter.emitAsync('detail', createMockDetail());
    await waitForAsync();

    // The RainbowKit ConnectButton is mocked in setupTests.js
    expect(getByTestId('mock-connect-button')).toBeInTheDocument();
  });

  it('shows RSVP button when registration is allowed', async () => {
    const { getByText } = renderWithProviders(
      <FormInput
        eventEmitter={eventEmitter}
        action={mockAction}
        getAccounts={mockGetAccounts}
        getDetail={mockGetDetail}
        read_only={false}
      />
    );

    // Emit accounts and detail
    await eventEmitter.emitAsync('accounts_received', ['0x1234567890123456789012345678901234567890']);
    await eventEmitter.emitAsync('detail', createMockDetail({ canRegister: true }));
    await waitForAsync();

    expect(getByText('RSVP')).toBeInTheDocument();
  });

  it('shows Withdraw button', async () => {
    const { getByText } = renderWithProviders(
      <FormInput
        eventEmitter={eventEmitter}
        action={mockAction}
        getAccounts={mockGetAccounts}
        getDetail={mockGetDetail}
        read_only={false}
      />
    );

    // Emit accounts and detail
    await eventEmitter.emitAsync('accounts_received', ['0x1234567890123456789012345678901234567890']);
    await eventEmitter.emitAsync('detail', createMockDetail());
    await waitForAsync();

    expect(getByText('Withdraw')).toBeInTheDocument();
  });

  it('shows admin buttons for owner', async () => {
    const ownerAddress = '0x1234567890123456789012345678901234567890';

    const { getByText } = renderWithProviders(
      <FormInput
        eventEmitter={eventEmitter}
        action={mockAction}
        getAccounts={mockGetAccounts}
        getDetail={mockGetDetail}
        read_only={false}
      />
    );

    // Emit owner account and detail
    await eventEmitter.emitAsync('accounts_received', [ownerAddress]);
    await eventEmitter.emitAsync('detail', createMockDetail({
      owner: ownerAddress,
      canPayback: true,
      canCancel: true,
    }));
    await waitForAsync();

    expect(getByText('Payback')).toBeInTheDocument();
    expect(getByText('Cancel')).toBeInTheDocument();
  });

  it('shows event over message when ended', async () => {
    const { getByText } = renderWithProviders(
      <FormInput
        eventEmitter={eventEmitter}
        action={mockAction}
        getAccounts={mockGetAccounts}
        getDetail={mockGetDetail}
        read_only={false}
      />
    );

    // Emit accounts and ended event detail
    await eventEmitter.emitAsync('accounts_received', ['0x1234567890123456789012345678901234567890']);
    await eventEmitter.emitAsync('detail', createMockDetail({ ended: true }));
    await waitForAsync();

    expect(getByText(/This event is over/)).toBeInTheDocument();
  });

  it('shows no spots message when full', async () => {
    const { getByText } = renderWithProviders(
      <FormInput
        eventEmitter={eventEmitter}
        action={mockAction}
        getAccounts={mockGetAccounts}
        getDetail={mockGetDetail}
        read_only={false}
      />
    );

    // Emit accounts and full event
    await eventEmitter.emitAsync('accounts_received', ['0x1234567890123456789012345678901234567890']);
    await eventEmitter.emitAsync('detail', createMockDetail({
      registered: 20,
      limitOfParticipants: 20,
    }));
    await waitForAsync();

    expect(getByText(/No more spots left/)).toBeInTheDocument();
  });

  it('shows no account message when no accounts available', async () => {
    const { getByText } = renderWithProviders(
      <FormInput
        eventEmitter={eventEmitter}
        action={mockAction}
        getAccounts={mockGetAccounts}
        getDetail={mockGetDetail}
        read_only={false}
      />
    );

    // Emit empty accounts
    await eventEmitter.emitAsync('accounts_received', []);
    await eventEmitter.emitAsync('detail', createMockDetail());
    await waitForAsync();

    expect(getByText(/No account is set/)).toBeInTheDocument();
  });
});
