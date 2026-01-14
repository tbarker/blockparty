import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import MetadataEditor from '../../components/MetadataEditor';

// Mock the arweaveUpload module
jest.mock('../../util/arweaveUpload', () => ({
  uploadEventMetadata: jest.fn(),
  getUploadCost: jest.fn(),
  isUploadAvailable: jest.fn().mockResolvedValue(true),
}));

// Mock the arweaveMetadata module
jest.mock('../../util/arweaveMetadata', () => ({
  arweaveUriToGatewayUrl: jest.fn(uri => {
    if (!uri) return null;
    if (uri.startsWith('https://')) return uri;
    return `https://arweave.net/${uri.replace('ar://', '')}`;
  }),
}));

describe('MetadataEditor', () => {
  const mockMetadata = {
    name: 'Test Event',
    date: '2026-03-15T18:30:00Z',
    endDate: '2026-03-15T21:00:00Z',
    location: {
      name: 'Test Venue',
      address: '123 Test St',
      mapUrl: 'https://maps.google.com/?q=test',
    },
    description: 'Test event description',
    images: {
      banner: 'ar://testBannerId',
    },
    links: {
      website: 'https://example.com',
      twitter: 'https://twitter.com/test',
    },
  };

  const defaultProps = {
    open: true,
    onClose: jest.fn(),
    metadata: mockMetadata,
    provider: {},
    onUpdateContract: jest.fn(),
    eventName: 'Test Event Name',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the dialog when open', () => {
    render(<MetadataEditor {...defaultProps} />);

    expect(screen.getByText('Edit Event Details')).toBeInTheDocument();
    expect(screen.getByText('Test Event Name')).toBeInTheDocument();
  });

  it('does not render content when closed', () => {
    render(<MetadataEditor {...defaultProps} open={false} />);

    expect(screen.queryByText('Edit Event Details')).not.toBeInTheDocument();
  });

  it('pre-populates form with existing metadata', () => {
    render(<MetadataEditor {...defaultProps} />);

    expect(screen.getByLabelText('Event Name')).toHaveValue('Test Event');
    expect(screen.getByLabelText('Venue Name')).toHaveValue('Test Venue');
    expect(screen.getByLabelText('Address')).toHaveValue('123 Test St');
    expect(screen.getByLabelText('Description')).toHaveValue('Test event description');
    expect(screen.getByLabelText('Website')).toHaveValue('https://example.com');
    expect(screen.getByLabelText('Twitter/X')).toHaveValue('https://twitter.com/test');
  });

  it('allows editing form fields', () => {
    render(<MetadataEditor {...defaultProps} />);

    const nameField = screen.getByLabelText('Event Name');
    fireEvent.change(nameField, { target: { value: 'Updated Event Name' } });

    expect(nameField).toHaveValue('Updated Event Name');
  });

  it('calls onClose when Cancel button is clicked', () => {
    render(<MetadataEditor {...defaultProps} />);

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('calls onClose when close icon is clicked', () => {
    render(<MetadataEditor {...defaultProps} />);

    // Find the close button (icon button in title)
    const closeButton = screen.getByRole('button', { name: '' });
    fireEvent.click(closeButton);

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('shows upload button with correct text', () => {
    render(<MetadataEditor {...defaultProps} />);

    expect(screen.getByText('Save & Upload to Arweave')).toBeInTheDocument();
  });

  it('shows image upload button', () => {
    render(<MetadataEditor {...defaultProps} />);

    expect(screen.getByText('Upload Image')).toBeInTheDocument();
  });

  it('handles empty metadata gracefully', () => {
    render(<MetadataEditor {...defaultProps} metadata={{}} />);

    expect(screen.getByLabelText('Event Name')).toHaveValue('');
    expect(screen.getByLabelText('Venue Name')).toHaveValue('');
    expect(screen.getByLabelText('Description')).toHaveValue('');
  });

  it('handles null metadata gracefully', () => {
    render(<MetadataEditor {...defaultProps} metadata={null} />);

    expect(screen.getByLabelText('Event Name')).toHaveValue('');
    expect(screen.getByLabelText('Venue Name')).toHaveValue('');
  });

  it('shows error alert when file type is invalid', async () => {
    render(<MetadataEditor {...defaultProps} />);

    // Create a non-image file
    const textFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
    const fileInput = document.querySelector('input[type="file"]');

    // Simulate file selection
    Object.defineProperty(fileInput, 'files', {
      value: [textFile],
    });
    fireEvent.change(fileInput);

    await waitFor(() => {
      expect(screen.getByText('Please select an image file')).toBeInTheDocument();
    });
  });

  it('shows all required sections', () => {
    render(<MetadataEditor {...defaultProps} />);

    // Check for section labels
    expect(screen.getByText('Location')).toBeInTheDocument();
    expect(screen.getByText('Links')).toBeInTheDocument();
    expect(screen.getByText('Banner Image')).toBeInTheDocument();
  });

  it('renders date/time fields', () => {
    render(<MetadataEditor {...defaultProps} />);

    expect(screen.getByLabelText('Start Date/Time')).toBeInTheDocument();
    expect(screen.getByLabelText('End Date/Time')).toBeInTheDocument();
  });

  describe('Date validation', () => {
    // Helper to render and wait for async state updates
    async function renderAndWait(props = {}) {
      let result;
      await act(async () => {
        result = render(<MetadataEditor {...defaultProps} {...props} />);
        // Wait for isUploadAvailable to resolve
        await new Promise(resolve => setTimeout(resolve, 10));
      });
      return result;
    }

    it('shows validation error when end date is before start date', async () => {
      await renderAndWait();

      // Set dates - end date before start date
      const dateInputs = document.querySelectorAll('input[type="datetime-local"]');
      const startDate = '2024-06-15T14:00';
      const endDate = '2024-06-14T14:00'; // Before start

      await act(async () => {
        fireEvent.change(dateInputs[0], { target: { value: startDate } });
        fireEvent.change(dateInputs[1], { target: { value: endDate } });
      });

      const submitButton = screen.getByText('Save & Upload to Arweave');
      await act(async () => {
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        // Error appears in Alert
        expect(screen.getByRole('alert')).toHaveTextContent('End date must be after start date');
      });
    });

    it('shows validation error when end date is set without start date', async () => {
      await renderAndWait({ metadata: {} });

      // Set only end date - ensure start date is empty by explicitly clearing it
      const dateInputs = document.querySelectorAll('input[type="datetime-local"]');
      const endDate = '2024-06-15T14:00';

      await act(async () => {
        // Explicitly clear start date to ensure it's empty
        fireEvent.change(dateInputs[0], { target: { value: '' } });
        fireEvent.change(dateInputs[1], { target: { value: endDate } });
      });

      const submitButton = screen.getByText('Save & Upload to Arweave');
      await act(async () => {
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        // Error appears in Alert
        expect(screen.getByRole('alert')).toHaveTextContent('Start date is required when end date is set');
      });
    });

    it('allows dates in the past for editing existing events', async () => {
      // MetadataEditor allows past dates since we're editing existing events
      const pastMetadata = {
        ...mockMetadata,
        date: '2020-01-15T14:00:00Z',
        endDate: '2020-01-15T18:00:00Z',
      };

      const { uploadEventMetadata } = require('../../util/arweaveUpload');
      uploadEventMetadata.mockResolvedValue('ar://newUri');

      await renderAndWait({ metadata: pastMetadata, onUpdateContract: jest.fn().mockResolvedValue() });

      const submitButton = screen.getByText('Save & Upload to Arweave');
      await act(async () => {
        fireEvent.click(submitButton);
      });

      // Should not show any date-related errors
      await waitFor(() => {
        expect(screen.queryByText(/must be in the future/)).not.toBeInTheDocument();
      });
    });

    it('shows field-level error on blur when end date is set without start date', async () => {
      await renderAndWait({ metadata: {} });

      const dateInputs = document.querySelectorAll('input[type="datetime-local"]');
      const endDate = '2024-06-15T14:00';

      await act(async () => {
        // Explicitly clear start date to ensure it's empty
        fireEvent.change(dateInputs[0], { target: { value: '' } });
        fireEvent.change(dateInputs[1], { target: { value: endDate } });
        fireEvent.blur(dateInputs[1]);
      });

      await waitFor(() => {
        // Error appears in helper text under the end date field
        expect(screen.getByText('Start date is required when end date is set')).toBeInTheDocument();
      });
    });
  });
});
