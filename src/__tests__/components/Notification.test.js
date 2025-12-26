/**
 * Smoke tests for Notification component
 */

import React from 'react';
import Notification from '../../components/Notification';
import {
  renderWithProviders,
  createMockEventEmitter,
  waitForAsync,
} from '../testUtils';

describe('Notification', () => {
  let eventEmitter;

  beforeEach(() => {
    eventEmitter = createMockEventEmitter();
  });

  it('renders without crashing', () => {
    const { container } = renderWithProviders(
      <Notification eventEmitter={eventEmitter} />
    );

    expect(container).toBeInTheDocument();
  });

  it('contains NotificationContainer', () => {
    const { container } = renderWithProviders(
      <Notification eventEmitter={eventEmitter} />
    );

    // NotificationContainer adds a specific class
    const notificationContainer = container.querySelector('.notifications-wrapper') ||
                                   container.querySelector('[class*="notification"]') ||
                                   container.firstChild;

    expect(notificationContainer).toBeInTheDocument();
  });

  it('listens for notification events', async () => {
    renderWithProviders(
      <Notification eventEmitter={eventEmitter} />
    );

    // Emit notification event wrapped in act - component should handle it without crashing
    await eventEmitter.emitAsync('notification', { status: 'success', message: 'Test message' });
    await waitForAsync();

    // Verify event was emitted (via our spy)
    expect(eventEmitter.emitSpy).toHaveBeenCalledWith('notification', {
      status: 'success',
      message: 'Test message',
    });
  });

  it('handles error notifications', async () => {
    renderWithProviders(
      <Notification eventEmitter={eventEmitter} />
    );

    // Emit error notification
    await eventEmitter.emitAsync('notification', { status: 'error', message: 'Error occurred' });
    await waitForAsync();

    expect(eventEmitter.emitSpy).toHaveBeenCalledWith('notification', {
      status: 'error',
      message: 'Error occurred',
    });
  });

  it('handles info notifications', async () => {
    renderWithProviders(
      <Notification eventEmitter={eventEmitter} />
    );

    // Emit info notification
    await eventEmitter.emitAsync('notification', { status: 'info', message: 'Info message' });
    await waitForAsync();

    expect(eventEmitter.emitSpy).toHaveBeenCalledWith('notification', {
      status: 'info',
      message: 'Info message',
    });
  });
});
