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
import { validators, schemas, validateFields } from '../util/validation';

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

      // Field-level validation errors
      fieldErrors: {},
      // Track which fields have been touched (for showing errors)
      touched: {},
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
    const value = event.target.value;
    this.setState(prevState => {
      const newState = { [field]: value, error: null };

      // Validate field if it has been touched
      if (prevState.touched[field]) {
        const fieldError = this.validateField(field, value);
        newState.fieldErrors = {
          ...prevState.fieldErrors,
          [field]: fieldError,
        };
      }

      return newState;
    });
  };

  handleBlur = field => () => {
    this.setState(prevState => {
      const fieldError = this.validateField(field, prevState[field]);
      return {
        touched: { ...prevState.touched, [field]: true },
        fieldErrors: { ...prevState.fieldErrors, [field]: fieldError },
      };
    });
  };

  validateField = (field, value) => {
    // Use schema validators for known fields
    const validator = schemas.eventCreation[field];
    if (validator) {
      return validator(value);
    }

    // Special validation for date fields
    if (field === 'date' && value) {
      return validators.dateFuture(value, { fieldName: 'Start date' });
    }

    if (field === 'endDate') {
      // Check if end date requires start date
      const requiresStartError = validators.dateRequiresStart(value, this.state.date, { fieldName: 'End date' });
      if (requiresStartError) return requiresStartError;

      // Check if end date is in the future
      if (value) {
        const futureError = validators.dateFuture(value, { fieldName: 'End date' });
        if (futureError) return futureError;
      }

      // Check if end date is after start date
      if (value && this.state.date) {
        return validators.dateAfter(value, this.state.date, { fieldName: 'End date' });
      }
    }

    return null;
  };

  handleFileChange = event => {
    const file = event.target.files[0];
    if (file) {
      const fileError = validators.imageFile(file, { maxSizeMB: 5 });
      if (fileError) {
        this.setState({ error: fileError });
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
    const { name, deposit, limitOfParticipants, mapUrl, websiteUrl, twitterUrl, date, endDate } =
      this.state;

    // Validate all fields using the schema
    const errors = validateFields(
      { name, deposit, limitOfParticipants, mapUrl, websiteUrl, twitterUrl },
      schemas.eventCreation
    );

    // Validate start date is in the future
    if (date) {
      const startDateError = validators.dateFuture(date, { fieldName: 'Start date' });
      if (startDateError) {
        errors.date = startDateError;
      }
    }

    // Validate end date requires start date
    const requiresStartError = validators.dateRequiresStart(endDate, date, { fieldName: 'End date' });
    if (requiresStartError) {
      errors.endDate = requiresStartError;
    }

    // Validate end date is in the future
    if (endDate && !errors.endDate) {
      const endDateFutureError = validators.dateFuture(endDate, { fieldName: 'End date' });
      if (endDateFutureError) {
        errors.endDate = endDateFutureError;
      }
    }

    // Validate end date is after start date
    if (date && endDate && !errors.endDate) {
      const dateAfterError = validators.dateAfter(endDate, date, { fieldName: 'End date' });
      if (dateAfterError) {
        errors.endDate = dateAfterError;
      }
    }

    // Update field errors state and mark all as touched
    const allTouched = {
      name: true,
      deposit: true,
      limitOfParticipants: true,
      mapUrl: true,
      websiteUrl: true,
      twitterUrl: true,
      date: true,
      endDate: true,
    };

    this.setState({ fieldErrors: errors, touched: allTouched });

    // Return first error message for the alert, or null if valid
    const errorMessages = Object.values(errors).filter(Boolean);
    return errorMessages.length > 0 ? errorMessages[0] : null;
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
      fieldErrors: {},
      touched: {},
    });
  };

  // Helper to get error state for a field
  getFieldError = field => {
    const { fieldErrors, touched } = this.state;
    return touched[field] ? fieldErrors[field] : null;
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
              onBlur={this.handleBlur('name')}
              disabled={creating || !factoryAvailable}
              required
              error={!!this.getFieldError('name')}
              helperText={this.getFieldError('name') || 'The name of your event (required)'}
            />

            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                fullWidth
                label="Deposit Amount"
                type="number"
                value={this.state.deposit}
                onChange={this.handleChange('deposit')}
                onBlur={this.handleBlur('deposit')}
                disabled={creating || !factoryAvailable}
                required
                error={!!this.getFieldError('deposit')}
                InputProps={{
                  endAdornment: <InputAdornment position="end">ETH</InputAdornment>,
                }}
                inputProps={{ min: 0.001, max: 10, step: 0.01 }}
                helperText={this.getFieldError('deposit') || 'Amount each participant must deposit (0.001-10 ETH)'}
              />

              <TextField
                fullWidth
                label="Max Participants"
                type="number"
                value={this.state.limitOfParticipants}
                onChange={this.handleChange('limitOfParticipants')}
                onBlur={this.handleBlur('limitOfParticipants')}
                disabled={creating || !factoryAvailable}
                required
                error={!!this.getFieldError('limitOfParticipants')}
                inputProps={{ min: 1, max: 1000 }}
                helperText={this.getFieldError('limitOfParticipants') || 'Maximum number of participants (1-1000)'}
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
                onBlur={this.handleBlur('date')}
                disabled={creating || !factoryAvailable}
                error={!!this.getFieldError('date')}
                helperText={this.getFieldError('date')}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                fullWidth
                label="End Date/Time"
                type="datetime-local"
                value={this.state.endDate}
                onChange={this.handleChange('endDate')}
                onBlur={this.handleBlur('endDate')}
                disabled={creating || !factoryAvailable}
                error={!!this.getFieldError('endDate')}
                helperText={this.getFieldError('endDate')}
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
              onBlur={this.handleBlur('mapUrl')}
              disabled={creating || !factoryAvailable}
              error={!!this.getFieldError('mapUrl')}
              helperText={this.getFieldError('mapUrl')}
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
                onBlur={this.handleBlur('websiteUrl')}
                disabled={creating || !factoryAvailable}
                error={!!this.getFieldError('websiteUrl')}
                helperText={this.getFieldError('websiteUrl')}
                placeholder="https://..."
              />
              <TextField
                fullWidth
                label="Twitter/X"
                value={this.state.twitterUrl}
                onChange={this.handleChange('twitterUrl')}
                onBlur={this.handleBlur('twitterUrl')}
                disabled={creating || !factoryAvailable}
                error={!!this.getFieldError('twitterUrl')}
                helperText={this.getFieldError('twitterUrl')}
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
