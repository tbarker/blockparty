import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
    return `https://gateway.irys.xyz/${uri.replace('ar://', '')}`;
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
});
