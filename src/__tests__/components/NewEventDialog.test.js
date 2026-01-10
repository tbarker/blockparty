import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import NewEventDialog from '../../components/NewEventDialog';

// Mock the arweaveUpload module
jest.mock('../../util/arweaveUpload', () => ({
  uploadEventMetadata: jest.fn(),
  isUploadAvailable: jest.fn().mockResolvedValue(true),
  waitForArweaveConfirmation: jest.fn().mockResolvedValue(true),
}));

describe('NewEventDialog', () => {
  const defaultProps = {
    open: true,
    onClose: jest.fn(),
    provider: {},
    onCreateEvent: jest.fn(),
    factoryAvailable: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Helper to render and wait for async state updates
  async function renderAndWait(props = {}) {
    let result;
    await act(async () => {
      result = render(<NewEventDialog {...defaultProps} {...props} />);
      // Wait for isUploadAvailable to resolve
      await new Promise(resolve => setTimeout(resolve, 10));
    });
    return result;
  }

  it('renders the dialog when open', async () => {
    await renderAndWait();
    expect(screen.getByText('Create New Event')).toBeInTheDocument();
  });

  it('does not render content when closed', async () => {
    await renderAndWait({ open: false });
    expect(screen.queryByText('Create New Event')).not.toBeInTheDocument();
  });

  it('shows factory not available error when factoryAvailable is false', async () => {
    await renderAndWait({ factoryAvailable: false });
    expect(screen.getByText(/Event factory is not available on this network/)).toBeInTheDocument();
  });

  it('has default values for form fields', async () => {
    await renderAndWait();
    // Use getAllByRole to find spinbuttons (number inputs) - these are the deposit and max participants fields
    const numberInputs = screen.getAllByRole('spinbutton');
    expect(numberInputs.length).toBeGreaterThanOrEqual(2);
    // First is deposit, second is max participants
    expect(numberInputs[0]).toHaveValue(0.02);
    expect(numberInputs[1]).toHaveValue(20);
  });

  it('allows editing form fields', async () => {
    await renderAndWait();

    // Get the first textbox (Event Name)
    const textboxes = screen.getAllByRole('textbox');
    const nameField = textboxes[0];
    await act(async () => {
      fireEvent.change(nameField, { target: { value: 'My Test Event' } });
    });

    expect(nameField).toHaveValue('My Test Event');
  });

  it('calls onClose when Cancel button is clicked', async () => {
    await renderAndWait();

    const cancelButton = screen.getByText('Cancel');
    await act(async () => {
      fireEvent.click(cancelButton);
    });

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('calls onClose when close icon is clicked', async () => {
    await renderAndWait();

    // Find the close button by its position in the dialog title
    const closeButtons = screen.getAllByRole('button');
    const closeButton = closeButtons.find(
      btn => btn.querySelector('svg[data-testid="CloseIcon"]') !== null
    );
    if (closeButton) {
      await act(async () => {
        fireEvent.click(closeButton);
      });
      expect(defaultProps.onClose).toHaveBeenCalled();
    }
  });

  it('shows Create Event button', async () => {
    await renderAndWait();
    expect(screen.getByText('Create Event')).toBeInTheDocument();
  });

  it('shows validation error when name is empty on submit', async () => {
    await renderAndWait();

    const createButton = screen.getByText('Create Event');
    await act(async () => {
      fireEvent.click(createButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Event name is required')).toBeInTheDocument();
    });
  });

  it('shows validation error when deposit is zero', async () => {
    await renderAndWait();

    // Fill in name
    const textboxes = screen.getAllByRole('textbox');
    await act(async () => {
      fireEvent.change(textboxes[0], { target: { value: 'Test Event' } });
    });

    // Set deposit to 0
    const numberInputs = screen.getAllByRole('spinbutton');
    await act(async () => {
      fireEvent.change(numberInputs[0], { target: { value: '0' } });
    });

    const createButton = screen.getByText('Create Event');
    await act(async () => {
      fireEvent.click(createButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Deposit must be a positive number')).toBeInTheDocument();
    });
  });

  it('shows validation error when deposit exceeds max', async () => {
    await renderAndWait();

    const textboxes = screen.getAllByRole('textbox');
    await act(async () => {
      fireEvent.change(textboxes[0], { target: { value: 'Test Event' } });
    });

    const numberInputs = screen.getAllByRole('spinbutton');
    await act(async () => {
      fireEvent.change(numberInputs[0], { target: { value: '15' } });
    });

    const createButton = screen.getByText('Create Event');
    await act(async () => {
      fireEvent.click(createButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Deposit cannot exceed 10 ETH')).toBeInTheDocument();
    });
  });

  it('shows validation error when max participants is zero', async () => {
    await renderAndWait();

    const textboxes = screen.getAllByRole('textbox');
    await act(async () => {
      fireEvent.change(textboxes[0], { target: { value: 'Test Event' } });
    });

    const numberInputs = screen.getAllByRole('spinbutton');
    await act(async () => {
      fireEvent.change(numberInputs[1], { target: { value: '0' } });
    });

    const createButton = screen.getByText('Create Event');
    await act(async () => {
      fireEvent.click(createButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Max participants must be at least 1')).toBeInTheDocument();
    });
  });

  it('shows validation error when max participants exceeds limit', async () => {
    await renderAndWait();

    const textboxes = screen.getAllByRole('textbox');
    await act(async () => {
      fireEvent.change(textboxes[0], { target: { value: 'Test Event' } });
    });

    const numberInputs = screen.getAllByRole('spinbutton');
    await act(async () => {
      fireEvent.change(numberInputs[1], { target: { value: '2000' } });
    });

    const createButton = screen.getByText('Create Event');
    await act(async () => {
      fireEvent.click(createButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Max participants cannot exceed 1000')).toBeInTheDocument();
    });
  });

  it('calls onCreateEvent with correct params when form is valid', async () => {
    const mockOnCreateEvent = jest.fn().mockResolvedValue('0x1234567890abcdef');
    await renderAndWait({ onCreateEvent: mockOnCreateEvent });

    // Fill in required fields
    const textboxes = screen.getAllByRole('textbox');
    await act(async () => {
      fireEvent.change(textboxes[0], { target: { value: 'Test Event' } });
    });

    const createButton = screen.getByText('Create Event');
    await act(async () => {
      fireEvent.click(createButton);
    });

    await waitFor(() => {
      expect(mockOnCreateEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Event',
          deposit: '0.02',
          limitOfParticipants: 20,
          coolingPeriod: 604800,
        })
      );
    });
  });

  it('shows success dialog after successful creation', async () => {
    const mockOnCreateEvent = jest
      .fn()
      .mockResolvedValue('0x1234567890abcdef1234567890abcdef12345678');
    await renderAndWait({ onCreateEvent: mockOnCreateEvent });

    const textboxes = screen.getAllByRole('textbox');
    await act(async () => {
      fireEvent.change(textboxes[0], { target: { value: 'Test Event' } });
    });

    const createButton = screen.getByText('Create Event');
    await act(async () => {
      fireEvent.click(createButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Event Created Successfully!')).toBeInTheDocument();
    });

    expect(screen.getByText('Go to Event')).toBeInTheDocument();
    expect(screen.getByText('Create Another Event')).toBeInTheDocument();
  });

  it('shows error when onCreateEvent fails', async () => {
    const mockOnCreateEvent = jest.fn().mockRejectedValue(new Error('Transaction failed'));
    await renderAndWait({ onCreateEvent: mockOnCreateEvent });

    const textboxes = screen.getAllByRole('textbox');
    await act(async () => {
      fireEvent.change(textboxes[0], { target: { value: 'Test Event' } });
    });

    const createButton = screen.getByText('Create Event');
    await act(async () => {
      fireEvent.click(createButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Transaction failed')).toBeInTheDocument();
    });
  });

  it('disables form when factory is not available', async () => {
    await renderAndWait({ factoryAvailable: false });

    const textboxes = screen.getAllByRole('textbox');
    expect(textboxes[0]).toBeDisabled(); // Event Name

    const numberInputs = screen.getAllByRole('spinbutton');
    expect(numberInputs[0]).toBeDisabled(); // Deposit
    expect(numberInputs[1]).toBeDisabled(); // Max Participants
  });

  it('shows all optional metadata fields', async () => {
    await renderAndWait();

    // Check for metadata section
    expect(screen.getByText('Event Details (stored on Arweave)')).toBeInTheDocument();
    // Check for Links section
    expect(screen.getByText('Links')).toBeInTheDocument();
  });

  it('shows image upload button', async () => {
    await renderAndWait();
    expect(screen.getByText('Upload Image')).toBeInTheDocument();
  });

  it('shows error for invalid image file', async () => {
    await renderAndWait();

    const textFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
    const fileInput = document.querySelector('input[type="file"]');

    await act(async () => {
      Object.defineProperty(fileInput, 'files', {
        value: [textFile],
      });
      fireEvent.change(fileInput);
    });

    await waitFor(() => {
      expect(screen.getByText('Please select an image file')).toBeInTheDocument();
    });
  });

  it('shows error for image file too large', async () => {
    await renderAndWait();

    // Create a mock file larger than 5MB
    const largeFile = new File(['x'.repeat(6 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' });
    Object.defineProperty(largeFile, 'size', { value: 6 * 1024 * 1024 });

    const fileInput = document.querySelector('input[type="file"]');

    await act(async () => {
      Object.defineProperty(fileInput, 'files', {
        value: [largeFile],
      });
      fireEvent.change(fileInput);
    });

    await waitFor(() => {
      expect(screen.getByText('Image must be smaller than 5MB')).toBeInTheDocument();
    });
  });

  it('shows cooling period selector', async () => {
    await renderAndWait();
    // Check for cooling period label text
    expect(
      screen.getByText(/Time after event ends before unclaimed deposits can be cleared/)
    ).toBeInTheDocument();
  });

  it('shows section headers', async () => {
    await renderAndWait();

    expect(screen.getByText('Event Settings (stored on blockchain)')).toBeInTheDocument();
    expect(screen.getByText('Event Details (stored on Arweave)')).toBeInTheDocument();
    expect(screen.getByText('Links')).toBeInTheDocument();
    expect(screen.getByText('Banner Image')).toBeInTheDocument();
  });

  describe('Arweave confirmation', () => {
    const { uploadEventMetadata, waitForArweaveConfirmation } = require('../../util/arweaveUpload');

    beforeEach(() => {
      uploadEventMetadata.mockReset();
      waitForArweaveConfirmation.mockReset();
      // Default: uploads succeed and confirmation succeeds
      uploadEventMetadata.mockResolvedValue('ar://test-metadata-uri');
      waitForArweaveConfirmation.mockResolvedValue(true);
    });

    // Helper to fill event name and trigger metadata by adding a venue name
    async function fillFormWithMetadata() {
      const textboxes = screen.getAllByRole('textbox');
      // textboxes[0] = Event Name
      // textboxes[1] = Venue Name (triggers hasMetadata)
      await act(async () => {
        fireEvent.change(textboxes[0], { target: { value: 'Test Event' } });
        fireEvent.change(textboxes[1], { target: { value: 'Test Venue' } });
      });
    }

    it('waits for Arweave confirmation after metadata upload', async () => {
      const mockOnCreateEvent = jest.fn().mockResolvedValue('0x1234567890abcdef');
      await renderAndWait({ onCreateEvent: mockOnCreateEvent });

      await fillFormWithMetadata();

      const createButton = screen.getByText('Create Event');
      await act(async () => {
        fireEvent.click(createButton);
      });

      await waitFor(() => {
        expect(uploadEventMetadata).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(waitForArweaveConfirmation).toHaveBeenCalledWith(
          'ar://test-metadata-uri',
          expect.objectContaining({
            maxAttempts: 30,
            intervalMs: 2000,
          })
        );
      });

      // Should proceed to create the event after confirmation
      await waitFor(() => {
        expect(mockOnCreateEvent).toHaveBeenCalled();
      });
    });

    it('shows error and stops when Arweave confirmation times out', async () => {
      waitForArweaveConfirmation.mockResolvedValue(false); // Simulate timeout

      const mockOnCreateEvent = jest.fn().mockResolvedValue('0x1234567890abcdef');
      await renderAndWait({ onCreateEvent: mockOnCreateEvent });

      await fillFormWithMetadata();

      const createButton = screen.getByText('Create Event');
      await act(async () => {
        fireEvent.click(createButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/Arweave upload confirmation timed out/)).toBeInTheDocument();
      });

      // Should NOT create the event
      expect(mockOnCreateEvent).not.toHaveBeenCalled();
    });

    it('shows error and stops when metadata upload fails', async () => {
      uploadEventMetadata.mockRejectedValue(new Error('Upload network error'));

      const mockOnCreateEvent = jest.fn().mockResolvedValue('0x1234567890abcdef');
      await renderAndWait({ onCreateEvent: mockOnCreateEvent });

      await fillFormWithMetadata();

      const createButton = screen.getByText('Create Event');
      await act(async () => {
        fireEvent.click(createButton);
      });

      await waitFor(() => {
        expect(
          screen.getByText(/Metadata upload failed.*Upload network error/)
        ).toBeInTheDocument();
      });

      // Should NOT create the event
      expect(mockOnCreateEvent).not.toHaveBeenCalled();
    });

    it('skips Arweave confirmation when no metadata is provided', async () => {
      const mockOnCreateEvent = jest.fn().mockResolvedValue('0x1234567890abcdef');
      await renderAndWait({ onCreateEvent: mockOnCreateEvent });

      // Fill in only the required name field (no metadata)
      const textboxes = screen.getAllByRole('textbox');
      await act(async () => {
        fireEvent.change(textboxes[0], { target: { value: 'Test Event' } });
      });

      const createButton = screen.getByText('Create Event');
      await act(async () => {
        fireEvent.click(createButton);
      });

      await waitFor(() => {
        expect(mockOnCreateEvent).toHaveBeenCalled();
      });

      // Should NOT call upload or confirmation functions
      expect(uploadEventMetadata).not.toHaveBeenCalled();
      expect(waitForArweaveConfirmation).not.toHaveBeenCalled();
    });
  });
});
