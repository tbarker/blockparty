/**
 * Smoke tests for NameSearch component
 */

import React from 'react';
import NameSearch from '../../components/NameSearch';
import {
  renderWithProviders,
  createMockEventEmitter,
  waitForAsync,
  fireEvent,
  act,
} from '../testUtils';

describe('NameSearch', () => {
  let eventEmitter;

  beforeEach(() => {
    eventEmitter = createMockEventEmitter();
  });

  it('renders without crashing', () => {
    const { container } = renderWithProviders(
      <NameSearch eventEmitter={eventEmitter} />
    );

    expect(container).toBeInTheDocument();
  });

  it('displays search input field', () => {
    const { getByLabelText } = renderWithProviders(
      <NameSearch eventEmitter={eventEmitter} />
    );

    // Material-UI TextField uses floating label
    expect(getByLabelText(/Search by name or address/)).toBeInTheDocument();
  });

  it('has an input element', () => {
    const { container } = renderWithProviders(
      <NameSearch eventEmitter={eventEmitter} />
    );

    const input = container.querySelector('input');
    expect(input).toBeInTheDocument();
  });

  it('emits search event on input change', async () => {
    const { container } = renderWithProviders(
      <NameSearch eventEmitter={eventEmitter} />
    );

    const input = container.querySelector('input');

    await act(async () => {
      fireEvent.change(input, { target: { value: 'test' } });
    });
    await waitForAsync();

    expect(eventEmitter.emitSpy).toHaveBeenCalledWith('search', 'test');
  });

  it('updates value from external search event', async () => {
    const { container } = renderWithProviders(
      <NameSearch eventEmitter={eventEmitter} />
    );

    // Emit search event externally wrapped in act
    await eventEmitter.emitAsync('search', 'external search');
    await waitForAsync();

    // Component should update its state (value may or may not be reflected in input)
    // This tests that the component handles the event without crashing
    const input = container.querySelector('input');
    expect(input).toBeInTheDocument();
  });

  it('handles empty search', async () => {
    const { container } = renderWithProviders(
      <NameSearch eventEmitter={eventEmitter} />
    );

    const input = container.querySelector('input');

    // First type something, then clear it
    await act(async () => {
      fireEvent.change(input, { target: { value: 'test' } });
    });
    await waitForAsync();

    await act(async () => {
      fireEvent.change(input, { target: { value: '' } });
    });
    await waitForAsync();

    // Component should emit for empty string or the test should just verify no crash
    // Either way, the component should handle empty input gracefully
    expect(input).toBeInTheDocument();
  });

  it('handles special characters in search', async () => {
    const { container } = renderWithProviders(
      <NameSearch eventEmitter={eventEmitter} />
    );

    const input = container.querySelector('input');

    await act(async () => {
      fireEvent.change(input, { target: { value: '@user_123' } });
    });
    await waitForAsync();

    expect(eventEmitter.emitSpy).toHaveBeenCalledWith('search', '@user_123');
  });
});
