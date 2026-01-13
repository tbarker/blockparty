import React from 'react';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import EditIcon from '@mui/icons-material/Edit';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import participantStatus from '../util/participantStatus';
import MetadataEditor from './MetadataEditor';
import { schemas } from '../util/validation';

const buttonStyle = { margin: '12px' };

class FormInput extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      address: '',
      name: '',
      accounts: [],
      attendees: [],
      participants: [],
      detail: {},
      showMetadataEditor: false,
      nameError: null,
      nameTouched: false,
    };
  }

  componentDidMount() {
    this.props.eventEmitter.on('accounts_received', accounts => {
      this.setState({
        address: accounts[0] || '',
        accounts: accounts,
      });
    });

    this.props.eventEmitter.on('participants_updated', participants => {
      this.setState({
        participants: participants,
      });
    });

    this.props.eventEmitter.on('detail', detail => {
      this.setState({ detail: detail });
    });

    this.props.eventEmitter.on('attendees', attendees => {
      this.setState({
        attendees: attendees,
      });
    });
  }

  handleAction(actionName) {
    var args = [];
    switch (actionName) {
      case 'grant':
        args.push(this.state.attendees);
        break;
      case 'attend':
        args.push(this.state.attendees);
        break;
      case 'register': {
        // Validate name before registering
        const nameError = this.validateName();
        if (nameError) {
          return; // Don't proceed if validation fails
        }
        args.push(this.state.name);
        break;
      }
      default:
        break;
    }
    if (actionName == 'register') {
      let obj = {
        action: 'register',
        user: this.state.address,
        contract: this.state.detail.contractAddress,
        agent: navigator.userAgent,
        provider: 'ethers.js',
        hostname: window.location.hostname,
        created_at: new Date(),
      };
      this.props.eventEmitter.emit('logger', obj);
    }

    this.props.action(actionName, this.state.address.trim(), args);
    this.setState({
      name: '',
      attendees: [],
      nameError: null,
      nameTouched: false,
    });
    this.props.eventEmitter.emit('attendees', []);
  }

  participantStatus() {
    var p = this.selectParticipant(this.state.participants, this.state.address);
    if (p) {
      return participantStatus(p, this.state.detail);
    } else {
      return 'Not registered';
    }
  }

  selectParticipant(participants, address) {
    return participants.filter(function (p) {
      return p.address == address;
    })[0];
  }

  isOwner() {
    return this.state.address == this.state.detail.owner;
  }

  isAdmin() {
    return (
      (this.state.detail.admins && this.state.detail.admins.includes(this.state.address)) ||
      this.state.detail.owner == this.state.address
    );
  }

  showRegister() {
    return this.state.detail.canRegister && this.participantStatus() == 'Not registered';
  }

  showAttend() {
    return this.state.detail.canAttend;
  }

  showWithdraw() {
    return (
      this.state.detail.canWithdraw &&
      (this.participantStatus() == 'Won' || this.participantStatus() == 'Cancelled')
    );
  }

  showPayback() {
    return this.state.detail.canPayback;
  }

  showCancel() {
    return this.state.detail.canCancel;
  }

  showClear() {
    return this.state.detail.ended;
  }

  handleName(e) {
    const value = e.target.value;
    this.setState(prevState => {
      const newState = { name: value };

      // Validate if field has been touched
      if (prevState.nameTouched) {
        newState.nameError = schemas.registration.participantName(value);
      }

      return newState;
    });
  }

  handleNameBlur = () => {
    this.setState(prevState => ({
      nameTouched: true,
      nameError: schemas.registration.participantName(prevState.name),
    }));
  };

  validateName() {
    const error = schemas.registration.participantName(this.state.name);
    this.setState({ nameError: error, nameTouched: true });
    return error;
  }

  openMetadataEditor = () => {
    this.setState({ showMetadataEditor: true });
  };

  closeMetadataEditor = () => {
    this.setState({ showMetadataEditor: false });
  };

  handleUpdateMetadata = async metadataUri => {
    // Emit event to update contract metadata
    this.props.eventEmitter.emit('updateMetadataUri', metadataUri);
  };

  getCurrentMetadata() {
    const { detail } = this.state;
    return {
      name: detail.name || '',
      date: detail.date || '',
      endDate: detail.endDate || '',
      location: {
        name: detail.location_text || '',
        address: detail.location_text || '',
        mapUrl: detail.map_url || '',
      },
      description: detail.description_text || '',
      images: detail.images || {},
      links: detail.links || {},
    };
  }

  canEditMetadata() {
    // Admins can edit metadata anytime the event is not ended
    return this.isAdmin() && !this.state.detail.ended;
  }

  render() {
    let adminButtons, registerButton, attendButton, warningText;

    if (this.isAdmin()) {
      attendButton = (
        <Button
          variant="contained"
          color={this.showAttend() ? 'secondary' : 'inherit'}
          disabled={!this.showAttend()}
          style={buttonStyle}
          onClick={this.handleAction.bind(this, 'attend')}
        >
          Batch Attend
        </Button>
      );
    }

    // Edit metadata button for admins
    let editMetadataButton = null;
    if (this.canEditMetadata()) {
      editMetadataButton = (
        <Button
          variant="outlined"
          color="primary"
          style={buttonStyle}
          onClick={this.openMetadataEditor}
          startIcon={<EditIcon />}
        >
          Edit Event Details
        </Button>
      );
    }

    if (this.isOwner()) {
      adminButtons = (
        <Box component="span">
          <Button
            variant="contained"
            color="secondary"
            style={buttonStyle}
            onClick={this.handleAction.bind(this, 'grant')}
          >
            Grant admin
          </Button>

          <Button
            variant="contained"
            color={this.showPayback() ? 'secondary' : 'inherit'}
            disabled={!this.showPayback()}
            style={buttonStyle}
            onClick={this.handleAction.bind(this, 'payback')}
          >
            Payback
          </Button>
          <Button
            variant="contained"
            color={this.showCancel() ? 'secondary' : 'inherit'}
            disabled={!this.showCancel()}
            style={buttonStyle}
            onClick={this.handleAction.bind(this, 'cancel')}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color={this.showClear() ? 'secondary' : 'inherit'}
            disabled={!this.showClear()}
            style={buttonStyle}
            onClick={this.handleAction.bind(this, 'clear')}
          >
            Clear
          </Button>
        </Box>
      );
    }

    var availableSpots = this.state.detail.limitOfParticipants - this.state.detail.registered;
    if (this.props.read_only) {
      registerButton = <span>Connect your wallet to register.</span>;
    } else if (this.state.accounts.length > 0) {
      if (this.state.detail.ended) {
        registerButton = <span>This event is over </span>;
      } else if (availableSpots <= 0) {
        registerButton = <span>No more spots left</span>;
      } else {
        registerButton = (
          <Button
            variant="contained"
            color={this.showRegister() ? 'secondary' : 'inherit'}
            disabled={!this.showRegister()}
            style={buttonStyle}
            onClick={this.handleAction.bind(this, 'register')}
          >
            RSVP
          </Button>
        );
        warningText = (
          <Box sx={{ textAlign: 'center', color: 'red' }}>
            Please be aware that you <strong>cannot</strong> cancel once regiesterd. Please read FAQ
            section at ABOUT page on top right corner for more detail about this service.
          </Box>
        );
      }
    } else {
      registerButton = <span>No account is set</span>;
    }

    var withdrawButton = (
      <Button
        variant="contained"
        color={this.showWithdraw() ? 'secondary' : 'inherit'}
        disabled={!this.showWithdraw()}
        style={buttonStyle}
        onClick={this.handleAction.bind(this, 'withdraw')}
      >
        Withdraw
      </Button>
    );

    let nameField = null;
    if (this.showRegister()) {
      const nameError = this.state.nameTouched ? this.state.nameError : null;
      nameField = (
        <TextField
          placeholder="@twitter_handle"
          label="Twitter handle *"
          value={this.state.name || ''}
          onChange={this.handleName.bind(this)}
          onBlur={this.handleNameBlur}
          variant="outlined"
          size="small"
          required
          error={!!nameError}
          helperText={nameError || 'Enter your Twitter handle (e.g., @username)'}
          sx={{ margin: '0 5px', minWidth: '280px' }}
        />
      );
    }

    return (
      <Paper elevation={1} sx={{ padding: 2 }}>
        <Box component="form" sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}>
          {nameField}
          <Box sx={{ margin: '0 5px' }}>
            <ConnectButton
              chainStatus="icon"
              showBalance={false}
              accountStatus={{
                smallScreen: 'avatar',
                largeScreen: 'full',
              }}
            />
          </Box>
          {registerButton}
          {withdrawButton}
          {attendButton}
          {editMetadataButton}
          {adminButtons}
        </Box>
        {warningText}

        {/* Metadata Editor Dialog */}
        <MetadataEditor
          open={this.state.showMetadataEditor}
          onClose={this.closeMetadataEditor}
          metadata={this.getCurrentMetadata()}
          provider={this.props.provider}
          onUpdateContract={this.handleUpdateMetadata}
          eventName={this.state.detail.name}
        />
      </Paper>
    );
  }
}

export default FormInput;
