import React, { Component } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  CircularProgress,
  Alert,
  LinearProgress,
  IconButton,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import {
  uploadEventMetadata,
  isUploadAvailable,
  waitForArweaveConfirmation,
} from '../util/arweaveUpload';

// Cooling period options (in seconds)
const COOLING_PERIODS = [
  { label: '1 day', value: 86400 },
  { label: '3 days', value: 259200 },
  { label: '1 week', value: 604800 },
  { label: '2 weeks', value: 1209600 },
  { label: '1 month', value: 2592000 },
];

/**
 * NewEventDialog - Dialog component for creating a new event
 *
 * Props:
 *   open: boolean - Whether the dialog is open
 *   onClose: function - Called when dialog should close
 *   provider: object - ethers.js provider
 *   networkId: string - The connected network's chain ID
 *   onCreateEvent: function(params) - Called to create the event contract
 *   factoryAvailable: boolean - Whether factory contract is available
 */
class NewEventDialog extends Component {
  constructor(props) {
    super(props);
    this.state = {
      // On-chain parameters
      name: '',
      deposit: '0.02',
      limitOfParticipants: '20',
      coolingPeriod: 604800, // 1 week default

      // Metadata fields
      date: '',
      endDate: '',
      locationName: '',
      locationAddress: '',
      mapUrl: '',
      description: '',
      websiteUrl: '',
      twitterUrl: '',

      // Image handling
      bannerFile: null,
      bannerPreview: null,

      // State
      creating: false,
      creationStep: '',
      error: null,
      success: null,
      newContractAddress: null,
      uploadAvailable: true,
    };
  }

  componentDidMount() {
    this.checkUploadAvailability();
  }

  componentDidUpdate(prevProps) {
    // Re-check upload availability when networkId changes
    if (prevProps.networkId !== this.props.networkId) {
      this.checkUploadAvailability();
    }
  }

  async checkUploadAvailability() {
    try {
      const { networkId } = this.props;
      const available = await isUploadAvailable(networkId);
      this.setState({ uploadAvailable: available });
    } catch {
      this.setState({ uploadAvailable: false });
    }
  }

  handleChange = field => event => {
    this.setState({ [field]: event.target.value, error: null });
  };

  handleFileChange = event => {
    const file = event.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        this.setState({ error: 'Please select an image file' });
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        this.setState({ error: 'Image must be smaller than 5MB' });
        return;
      }
      this.setState({
        bannerFile: file,
        bannerPreview: URL.createObjectURL(file),
        error: null,
      });
    }
  };

  clearBanner = () => {
    this.setState({ bannerFile: null, bannerPreview: null });
  };

  hasMetadata() {
    const { date, endDate, locationName, locationAddress, description, bannerFile } = this.state;
    return !!(date || endDate || locationName || locationAddress || description || bannerFile);
  }

  buildMetadata() {
    const {
      name,
      date,
      endDate,
      locationName,
      locationAddress,
      mapUrl,
      description,
      websiteUrl,
      twitterUrl,
    } = this.state;

    const metadata = {};

    if (name) metadata.name = name;
    if (date) metadata.date = new Date(date).toISOString();
    if (endDate) metadata.endDate = new Date(endDate).toISOString();

    if (locationName || locationAddress || mapUrl) {
      metadata.location = {};
      if (locationName) metadata.location.name = locationName;
      if (locationAddress) metadata.location.address = locationAddress;
      if (mapUrl) metadata.location.mapUrl = mapUrl;
    }

    if (description) metadata.description = description;

    metadata.images = {};

    if (websiteUrl || twitterUrl) {
      metadata.links = {};
      if (websiteUrl) metadata.links.website = websiteUrl;
      if (twitterUrl) metadata.links.twitter = twitterUrl;
    }

    return metadata;
  }

  validateForm() {
    const { name, deposit, limitOfParticipants } = this.state;

    if (!name || name.trim().length === 0) {
      return 'Event name is required';
    }
    if (name.length > 100) {
      return 'Event name must be less than 100 characters';
    }

    const depositNum = parseFloat(deposit);
    if (isNaN(depositNum) || depositNum <= 0) {
      return 'Deposit must be a positive number';
    }
    if (depositNum > 10) {
      return 'Deposit cannot exceed 10 ETH';
    }

    const limitNum = parseInt(limitOfParticipants, 10);
    if (isNaN(limitNum) || limitNum < 1) {
      return 'Max participants must be at least 1';
    }
    if (limitNum > 1000) {
      return 'Max participants cannot exceed 1000';
    }

    return null;
  }

  handleSubmit = async () => {
    const { provider, networkId, onCreateEvent } = this.props;

    // Validate form
    const validationError = this.validateForm();
    if (validationError) {
      this.setState({ error: validationError });
      return;
    }

    this.setState({
      creating: true,
      error: null,
      creationStep: 'Preparing...',
    });

    try {
      let metadataUri = '';

      // Upload metadata to Arweave if there's any metadata to upload
      if (this.hasMetadata() && this.state.uploadAvailable) {
        this.setState({ creationStep: 'Uploading metadata to Arweave...' });

        const metadata = this.buildMetadata();
        const imageFiles = {};
        if (this.state.bannerFile) {
          imageFiles.banner = this.state.bannerFile;
        }

        try {
          metadataUri = await uploadEventMetadata(
            provider,
            networkId,
            metadata,
            imageFiles,
            progress => {
              this.setState({ creationStep: progress.message });
            }
          );

          // Wait for Arweave to confirm the upload is available at the gateway
          // This prevents the "missing metadata" issue when navigating to the new event
          // Note: In devnet mode, this check is skipped since devnet data isn't on arweave.net
          this.setState({ creationStep: 'Waiting for Arweave to confirm upload...' });

          const confirmed = await waitForArweaveConfirmation(metadataUri, {
            maxAttempts: 30,
            intervalMs: 2000,
            networkId,
            onProgress: progress => {
              this.setState({ creationStep: `Waiting for confirmation (${progress.attempt}/${progress.maxAttempts})...` });
            },
          });

          if (!confirmed) {
            // Arweave confirmation timed out - show error and let user retry
            this.setState({
              error:
                'Arweave upload confirmation timed out. The data was uploaded but is not yet available. Please try again.',
              creating: false,
              creationStep: '',
            });
            return;
          }
        } catch (uploadError) {
          // If upload fails, show error and let user retry or cancel
          console.error('Metadata upload failed:', uploadError);
          this.setState({
            error: `Metadata upload failed: ${uploadError.message || 'Unknown error'}. Please try again.`,
            creating: false,
            creationStep: '',
          });
          return;
        }
      }

      // Create the contract
      this.setState({ creationStep: 'Creating event contract...' });

      const params = {
        name: this.state.name.trim(),
        deposit: this.state.deposit,
        limitOfParticipants: parseInt(this.state.limitOfParticipants, 10),
        coolingPeriod: this.state.coolingPeriod,
        metadataUri,
      };

      const newAddress = await onCreateEvent(params);

      this.setState({
        creating: false,
        success: true,
        newContractAddress: newAddress,
        creationStep: '',
      });
    } catch (error) {
      console.error('Error creating event:', error);
      this.setState({
        error: error.reason || error.message || 'Failed to create event',
        creating: false,
        creationStep: '',
      });
    }
  };

  handleGoToEvent = () => {
    const { newContractAddress } = this.state;
    if (newContractAddress) {
      // Navigate to the new event
      window.location.href = `${window.location.pathname}?contract=${newContractAddress}`;
    }
  };

  handleCreateAnother = () => {
    // Reset form
    this.setState({
      name: '',
      deposit: '0.02',
      limitOfParticipants: '20',
      coolingPeriod: 604800,
      date: '',
      endDate: '',
      locationName: '',
      locationAddress: '',
      mapUrl: '',
      description: '',
      websiteUrl: '',
      twitterUrl: '',
      bannerFile: null,
      bannerPreview: null,
      creating: false,
      creationStep: '',
      error: null,
      success: null,
      newContractAddress: null,
    });
  };

  render() {
    const { open, onClose, factoryAvailable } = this.props;
    const {
      creating,
      creationStep,
      error,
      success,
      newContractAddress,
      bannerPreview,
      bannerFile,
      uploadAvailable,
    } = this.state;

    // Success state
    if (success && newContractAddress) {
      return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
          <DialogTitle>Event Created Successfully!</DialogTitle>
          <DialogContent>
            <Alert severity="success" sx={{ mb: 2 }}>
              Your event has been created on the blockchain.
            </Alert>
            <Typography variant="body1" gutterBottom>
              Contract Address:
            </Typography>
            <Typography
              variant="body2"
              sx={{
                fontFamily: 'monospace',
                backgroundColor: '#f5f5f5',
                p: 1,
                borderRadius: 1,
                wordBreak: 'break-all',
              }}
            >
              {newContractAddress}
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={this.handleCreateAnother}>Create Another Event</Button>
            <Button variant="contained" onClick={this.handleGoToEvent}>
              Go to Event
            </Button>
          </DialogActions>
        </Dialog>
      );
    }

    return (
      <Dialog open={open} onClose={creating ? undefined : onClose} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Create New Event</span>
            {!creating && (
              <IconButton onClick={onClose} size="small">
                <CloseIcon />
              </IconButton>
            )}
          </Box>
        </DialogTitle>

        <DialogContent dividers>
          {!factoryAvailable && (
            <Alert severity="error" sx={{ mb: 2 }}>
              Event factory is not available on this network. Please deploy the ConferenceFactory
              contract first.
            </Alert>
          )}

          {!uploadAvailable && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Arweave upload is not available. Event will be created without metadata. You can add
              metadata later using the command-line tool.
            </Alert>
          )}

          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => this.setState({ error: null })}>
              {error}
            </Alert>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Required On-Chain Parameters */}
            <Typography variant="subtitle1" fontWeight="bold">
              Event Settings (stored on blockchain)
            </Typography>

            <TextField
              fullWidth
              label="Event Name"
              value={this.state.name}
              onChange={this.handleChange('name')}
              disabled={creating || !factoryAvailable}
              required
              helperText="The name of your event (required)"
            />

            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                fullWidth
                label="Deposit Amount"
                type="number"
                value={this.state.deposit}
                onChange={this.handleChange('deposit')}
                disabled={creating || !factoryAvailable}
                required
                InputProps={{
                  endAdornment: <InputAdornment position="end">ETH</InputAdornment>,
                }}
                inputProps={{ min: 0.001, max: 10, step: 0.01 }}
                helperText="Amount each participant must deposit"
              />

              <TextField
                fullWidth
                label="Max Participants"
                type="number"
                value={this.state.limitOfParticipants}
                onChange={this.handleChange('limitOfParticipants')}
                disabled={creating || !factoryAvailable}
                required
                inputProps={{ min: 1, max: 1000 }}
                helperText="Maximum number of participants"
              />
            </Box>

            <FormControl fullWidth disabled={creating || !factoryAvailable}>
              <InputLabel>Cooling Period</InputLabel>
              <Select
                value={this.state.coolingPeriod}
                label="Cooling Period"
                onChange={this.handleChange('coolingPeriod')}
              >
                {COOLING_PERIODS.map(option => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                Time after event ends before unclaimed deposits can be cleared
              </Typography>
            </FormControl>

            <Divider sx={{ my: 1 }} />

            {/* Optional Metadata */}
            <Typography variant="subtitle1" fontWeight="bold">
              Event Details (stored on Arweave)
            </Typography>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                fullWidth
                label="Start Date/Time"
                type="datetime-local"
                value={this.state.date}
                onChange={this.handleChange('date')}
                disabled={creating || !factoryAvailable}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                fullWidth
                label="End Date/Time"
                type="datetime-local"
                value={this.state.endDate}
                onChange={this.handleChange('endDate')}
                disabled={creating || !factoryAvailable}
                InputLabelProps={{ shrink: true }}
              />
            </Box>

            <TextField
              fullWidth
              label="Venue Name"
              value={this.state.locationName}
              onChange={this.handleChange('locationName')}
              disabled={creating || !factoryAvailable}
              placeholder="e.g., Imperial College London"
            />

            <TextField
              fullWidth
              label="Address"
              value={this.state.locationAddress}
              onChange={this.handleChange('locationAddress')}
              disabled={creating || !factoryAvailable}
              placeholder="e.g., Exhibition Road, London SW7 2AZ"
            />

            <TextField
              fullWidth
              label="Map URL"
              value={this.state.mapUrl}
              onChange={this.handleChange('mapUrl')}
              disabled={creating || !factoryAvailable}
              placeholder="https://maps.google.com/..."
            />

            <TextField
              fullWidth
              label="Description"
              value={this.state.description}
              onChange={this.handleChange('description')}
              disabled={creating || !factoryAvailable}
              multiline
              rows={3}
              placeholder="Describe your event..."
            />

            <Divider sx={{ my: 1 }} />

            {/* Links */}
            <Typography variant="subtitle2" color="text.secondary">
              Links
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                fullWidth
                label="Website"
                value={this.state.websiteUrl}
                onChange={this.handleChange('websiteUrl')}
                disabled={creating || !factoryAvailable}
                placeholder="https://..."
              />
              <TextField
                fullWidth
                label="Twitter/X"
                value={this.state.twitterUrl}
                onChange={this.handleChange('twitterUrl')}
                disabled={creating || !factoryAvailable}
                placeholder="https://twitter.com/..."
              />
            </Box>

            <Divider sx={{ my: 1 }} />

            {/* Banner Image */}
            <Typography variant="subtitle2" color="text.secondary">
              Banner Image
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Button
                variant="outlined"
                component="label"
                disabled={creating || !factoryAvailable}
                startIcon={<CloudUploadIcon />}
              >
                {bannerFile ? 'Change Image' : 'Upload Image'}
                <input type="file" hidden accept="image/*" onChange={this.handleFileChange} />
              </Button>
              {bannerFile && (
                <Button
                  variant="text"
                  color="secondary"
                  onClick={this.clearBanner}
                  disabled={creating}
                >
                  Remove
                </Button>
              )}
              <Typography variant="body2" color="text.secondary">
                Max 5MB, JPG/PNG/GIF
              </Typography>
            </Box>

            {bannerPreview && (
              <Box sx={{ mt: 1 }}>
                <img
                  src={bannerPreview}
                  alt="Banner preview"
                  style={{
                    maxWidth: '100%',
                    maxHeight: 150,
                    objectFit: 'contain',
                    borderRadius: 4,
                  }}
                />
              </Box>
            )}

            {/* Creation Progress */}
            {creating && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" gutterBottom>
                  {creationStep}
                </Typography>
                <LinearProgress />
              </Box>
            )}
          </Box>
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose} disabled={creating}>
            Cancel
          </Button>
          <Button
            onClick={this.handleSubmit}
            variant="contained"
            disabled={creating || !factoryAvailable}
            startIcon={creating ? <CircularProgress size={20} /> : null}
          >
            {creating ? 'Creating...' : 'Create Event'}
          </Button>
        </DialogActions>
      </Dialog>
    );
  }
}

export default NewEventDialog;
