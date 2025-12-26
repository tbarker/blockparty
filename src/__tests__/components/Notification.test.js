/**
 * Tests for Notification component (MUI Snackbar/Alert based)
 */

import React from 'react';
import Notification from '../../components/Notification';
import { renderWithProviders, createMockEventEmitter, waitForAsync } from '../testUtils';
import { screen, waitFor } from '@testing-library/react';

describe('Notification', () => {
  let eventEmitter;

  beforeEach(() => {
    eventEmitter = createMockEventEmitter();
  });

  it('renders without crashing', () => {
    const { container } = renderWithProviders(<Notification eventEmitter={eventEmitter} />);

    expect(container).toBeInTheDocument();
  });

  it('displays success notification when event is emitted', async () => {
    renderWithProviders(<Notification eventEmitter={eventEmitter} />);

    // Emit notification event
    await eventEmitter.emitAsync('notification', { status: 'success', message: 'Test success' });
    await waitForAsync();

    // Verify the alert is displayed with the message
    await waitFor(() => {
      expect(screen.getByText('Test success')).toBeInTheDocument();
    });

    // Verify it has success severity (green color via MUI Alert)
    const alert = screen.getByRole('alert');
    expect(alert).toHaveClass('MuiAlert-filledSuccess');
  });

  it('displays error notification when event is emitted', async () => {
    renderWithProviders(<Notification eventEmitter={eventEmitter} />);

    // Emit error notification
    await eventEmitter.emitAsync('notification', { status: 'error', message: 'Error occurred' });
    await waitForAsync();

    await waitFor(() => {
      expect(screen.getByText('Error occurred')).toBeInTheDocument();
    });

    const alert = screen.getByRole('alert');
    expect(alert).toHaveClass('MuiAlert-filledError');
  });

  it('displays info notification when event is emitted', async () => {
    renderWithProviders(<Notification eventEmitter={eventEmitter} />);

    // Emit info notification
    await eventEmitter.emitAsync('notification', { status: 'info', message: 'Info message' });
    await waitForAsync();

    await waitFor(() => {
      expect(screen.getByText('Info message')).toBeInTheDocument();
    });

    const alert = screen.getByRole('alert');
    expect(alert).toHaveClass('MuiAlert-filledInfo');
  });

  it('displays warning notification when event is emitted', async () => {
    renderWithProviders(<Notification eventEmitter={eventEmitter} />);

    // Emit warning notification
    await eventEmitter.emitAsync('notification', { status: 'warning', message: 'Warning message' });
    await waitForAsync();

    await waitFor(() => {
      expect(screen.getByText('Warning message')).toBeInTheDocument();
    });

    const alert = screen.getByRole('alert');
    expect(alert).toHaveClass('MuiAlert-filledWarning');
  });

  it('can display multiple notifications', async () => {
    renderWithProviders(<Notification eventEmitter={eventEmitter} />);

    // Emit multiple notifications
    await eventEmitter.emitAsync('notification', { status: 'info', message: 'First message' });
    await eventEmitter.emitAsync('notification', { status: 'success', message: 'Second message' });
    await waitForAsync();

    await waitFor(() => {
      expect(screen.getByText('First message')).toBeInTheDocument();
      expect(screen.getByText('Second message')).toBeInTheDocument();
    });
  });
});
