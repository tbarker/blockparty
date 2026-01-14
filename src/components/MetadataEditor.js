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
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { uploadEventMetadata, isUploadAvailable, getUploadCost } from '../util/arweaveUpload';
import { arweaveUriToGatewayUrl } from '../util/arweaveMetadata';
import { validators, schemas } from '../util/validation';

/**
 * MetadataEditor - Dialog component for editing event metadata
 *
 * Props:
 *   open: boolean - Whether the dialog is open
 *   onClose: function - Called when dialog should close
 *   metadata: object - Current metadata (name, date, location, description, images, links)
 *   provider: object - ethers.js provider for Arweave uploads
 *   onUpdateContract: function(metadataUri) - Called to update the contract with new URI
 *   eventName: string - On-chain event name (for display)
 */
class MetadataEditor extends Component {
  constructor(props) {
    super(props);
    this.state = {
      // Form fields
      name: '',
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
      existingBanner: null,

      // Upload state
      uploading: false,
      uploadProgress: null,
      estimatedCost: null,
      estimatingCost: false,
      uploadAvailable: true, // Will be checked on mount

      // Error handling
      error: null,

      // Field-level validation errors
      fieldErrors: {},
      // Track which fields have been touched
      touched: {},
    };
  }

  componentDidMount() {
    this.populateFromMetadata();
    this.checkUploadAvailability();
  }

  async checkUploadAvailability() {
    try {
      const available = await isUploadAvailable();
      this.setState({ uploadAvailable: available });
    } catch {
      this.setState({ uploadAvailable: false });
    }
  }

  componentDidUpdate(prevProps) {
    if (prevProps.metadata !== this.props.metadata) {
      this.populateFromMetadata();
    }
  }

  populateFromMetadata() {
    const { metadata } = this.props;
    if (metadata) {
      // Convert ISO date to datetime-local format
      const formatDateForInput = isoDate => {
        if (!isoDate) return '';
        try {
          const date = new Date(isoDate);
          return date.toISOString().slice(0, 16);
        } catch {
          return '';
        }
      };

      const existingBanner = metadata.images?.banner
        ? arweaveUriToGatewayUrl(metadata.images.banner)
        : null;

      this.setState({
        name: metadata.name || '',
        date: formatDateForInput(metadata.date),
        endDate: formatDateForInput(metadata.endDate),
        locationName: metadata.location?.name || '',
        locationAddress: metadata.location?.address || '',
        mapUrl: metadata.location?.mapUrl || '',
        description: metadata.description || '',
        websiteUrl: metadata.links?.website || '',
        twitterUrl: metadata.links?.twitter || '',
        existingBanner,
        bannerPreview: existingBanner,
      });
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
    const validator = schemas.metadataEditor[field];
    if (validator) {
      return validator(value);
    }

    // Special validation for endDate
    if (field === 'endDate') {
      // Check if end date requires start date
      const requiresStartError = validators.dateRequiresStart(value, this.state.date, { fieldName: 'End date' });
      if (requiresStartError) return requiresStartError;

      // Check if end date is after start date
      if (value && this.state.date) {
        return validators.dateAfter(value, this.state.date, { fieldName: 'End date' });
      }
    }

    return null;
  };

  // Helper to get error state for a field
  getFieldError = field => {
    const { fieldErrors, touched } = this.state;
    return touched[field] ? fieldErrors[field] : null;
  };

  handleFileChange = async event => {
    const file = event.target.files[0];
    if (file) {
      // Validate file using validator
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

      // Estimate upload cost
      await this.estimateCost();
    }
  };

  clearBanner = () => {
    this.setState({
      bannerFile: null,
      bannerPreview: this.state.existingBanner,
    });
  };

  buildMetadata() {
    const { name, date, endDate, locationName, locationAddress, mapUrl, description } = this.state;

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

    // Handle images - keep existing if no new file
    metadata.images = {};
    if (this.state.existingBanner && !this.state.bannerFile) {
      // Keep existing banner URI
      const existingUri = this.props.metadata?.images?.banner;
      if (existingUri) {
        metadata.images.banner = existingUri;
      }
    }

    // Handle links
    const { websiteUrl, twitterUrl } = this.state;
    if (websiteUrl || twitterUrl) {
      metadata.links = {};
      if (websiteUrl) metadata.links.website = websiteUrl;
      if (twitterUrl) metadata.links.twitter = twitterUrl;
    }

    return metadata;
  }

  estimateCost = async () => {
    const { provider } = this.props;
    if (!provider) return;

    this.setState({ estimatingCost: true });

    try {
      const metadata = this.buildMetadata();
      const imageFiles = {};
      if (this.state.bannerFile) {
        imageFiles.banner = this.state.bannerFile;
      }

      const cost = await getUploadCost(provider, metadata, imageFiles);
      this.setState({ estimatedCost: cost, estimatingCost: false });
    } catch (error) {
      console.error('Error estimating cost:', error);
      this.setState({ estimatingCost: false });
    }
  };

  validateForm = () => {
    const { mapUrl, websiteUrl, twitterUrl, date, endDate } = this.state;

    // Validate URL fields
    const errors = {};

    const mapUrlError = validators.url(mapUrl, { fieldName: 'Map URL', allowEmpty: true });
    if (mapUrlError) errors.mapUrl = mapUrlError;

    const websiteUrlError = validators.url(websiteUrl, { fieldName: 'Website URL', allowEmpty: true });
    if (websiteUrlError) errors.websiteUrl = websiteUrlError;

    const twitterUrlError = validators.url(twitterUrl, { fieldName: 'Twitter URL', allowEmpty: true });
    if (twitterUrlError) errors.twitterUrl = twitterUrlError;

    // Validate end date requires start date
    const requiresStartError = validators.dateRequiresStart(endDate, date, { fieldName: 'End date' });
    if (requiresStartError) {
      errors.endDate = requiresStartError;
    }

    // Validate end date is after start date
    if (date && endDate && !errors.endDate) {
      const dateAfterError = validators.dateAfter(endDate, date, { fieldName: 'End date' });
      if (dateAfterError) errors.endDate = dateAfterError;
    }

    // Mark all validated fields as touched
    const allTouched = { mapUrl: true, websiteUrl: true, twitterUrl: true, endDate: true };
    this.setState({ fieldErrors: errors, touched: allTouched });

    const errorMessages = Object.values(errors).filter(Boolean);
    return errorMessages.length > 0 ? errorMessages[0] : null;
  };

  handleSubmit = async () => {
    const { provider, onUpdateContract, onClose } = this.props;

    if (!provider) {
      this.setState({ error: 'No wallet provider available' });
      return;
    }

    // Validate form before submitting
    const validationError = this.validateForm();
    if (validationError) {
      this.setState({ error: validationError });
      return;
    }

    this.setState({ uploading: true, error: null, uploadProgress: null });

    try {
      const metadata = this.buildMetadata();
      const imageFiles = {};
      if (this.state.bannerFile) {
        imageFiles.banner = this.state.bannerFile;
      }

      // Upload to Arweave
      const metadataUri = await uploadEventMetadata(provider, metadata, imageFiles, progress => {
        this.setState({ uploadProgress: progress });
      });

      // Update contract
      this.setState({
        uploadProgress: { step: 0, total: 1, message: 'Updating contract...' },
      });

      await onUpdateContract(metadataUri);

      this.setState({ uploading: false });
      onClose();
    } catch (error) {
      console.error('Error uploading metadata:', error);
      this.setState({
        error: error.message || 'Failed to upload metadata',
        uploading: false,
      });
    }
  };

  render() {
    const { open, onClose, eventName } = this.props;
    const {
      uploading,
      uploadProgress,
      error,
      estimatedCost,
      estimatingCost,
      bannerPreview,
      bannerFile,
      uploadAvailable,
    } = this.state;

    return (
      <Dialog open={open} onClose={uploading ? undefined : onClose} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Edit Event Details</span>
            {!uploading && (
              <IconButton onClick={onClose} size="small">
                <CloseIcon />
              </IconButton>
            )}
          </Box>
          {eventName && (
            <Typography variant="body2" color="text.secondary">
              {eventName}
            </Typography>
          )}
        </DialogTitle>

        <DialogContent dividers>
          {!uploadAvailable && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Arweave upload is not available in this browser session. You can edit metadata, but
              upload may fail. Use the command-line tool as an alternative: npm run upload:metadata
            </Alert>
          )}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => this.setState({ error: null })}>
              {error}
            </Alert>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Event Name */}
            <TextField
              fullWidth
              label="Event Name"
              value={this.state.name}
              onChange={this.handleChange('name')}
              disabled={uploading}
              helperText="Display name for the event"
            />

            {/* Date/Time */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                fullWidth
                label="Start Date/Time"
                type="datetime-local"
                value={this.state.date}
                onChange={this.handleChange('date')}
                onBlur={this.handleBlur('date')}
                disabled={uploading}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                fullWidth
                label="End Date/Time"
                type="datetime-local"
                value={this.state.endDate}
                onChange={this.handleChange('endDate')}
                onBlur={this.handleBlur('endDate')}
                disabled={uploading}
                error={!!this.getFieldError('endDate')}
                helperText={this.getFieldError('endDate')}
                InputLabelProps={{ shrink: true }}
              />
            </Box>

            <Divider sx={{ my: 1 }} />

            {/* Location */}
            <Typography variant="subtitle2" color="text.secondary">
              Location
            </Typography>
            <TextField
              fullWidth
              label="Venue Name"
              value={this.state.locationName}
              onChange={this.handleChange('locationName')}
              disabled={uploading}
              placeholder="e.g., Imperial College London"
            />
            <TextField
              fullWidth
              label="Address"
              value={this.state.locationAddress}
              onChange={this.handleChange('locationAddress')}
              disabled={uploading}
              placeholder="e.g., Exhibition Road, London SW7 2AZ"
            />
            <TextField
              fullWidth
              label="Map URL"
              value={this.state.mapUrl}
              onChange={this.handleChange('mapUrl')}
              onBlur={this.handleBlur('mapUrl')}
              disabled={uploading}
              error={!!this.getFieldError('mapUrl')}
              helperText={this.getFieldError('mapUrl')}
              placeholder="https://maps.google.com/..."
            />

            <Divider sx={{ my: 1 }} />

            {/* Description */}
            <TextField
              fullWidth
              label="Description"
              value={this.state.description}
              onChange={this.handleChange('description')}
              disabled={uploading}
              multiline
              rows={4}
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
                disabled={uploading}
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
                disabled={uploading}
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
                disabled={uploading}
                startIcon={<CloudUploadIcon />}
              >
                {bannerFile ? 'Change Image' : 'Upload Image'}
                <input type="file" hidden accept="image/*" onChange={this.handleFileChange} />
              </Button>
              {bannerFile && (
                <Button variant="text" color="secondary" onClick={this.clearBanner}>
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
                    maxHeight: 200,
                    objectFit: 'contain',
                    borderRadius: 4,
                  }}
                />
              </Box>
            )}

            {/* Cost Estimate */}
            {estimatingCost && (
              <Typography variant="body2" color="text.secondary">
                Estimating upload cost...
              </Typography>
            )}
            {estimatedCost && !estimatingCost && (
              <Alert severity="info" sx={{ mt: 1 }}>
                Estimated upload cost: {estimatedCost.formatted} ({estimatedCost.sizeFormatted})
              </Alert>
            )}

            {/* Upload Progress */}
            {uploading && uploadProgress && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" gutterBottom>
                  {uploadProgress.message}
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={(uploadProgress.step / uploadProgress.total) * 100}
                />
              </Box>
            )}
          </Box>
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose} disabled={uploading}>
            Cancel
          </Button>
          <Button
            onClick={this.handleSubmit}
            variant="contained"
            disabled={uploading}
            startIcon={uploading ? <CircularProgress size={20} /> : null}
          >
            {uploading ? 'Uploading...' : 'Save & Upload to Arweave'}
          </Button>
        </DialogActions>
      </Dialog>
    );
  }
}

export default MetadataEditor;
