import React from 'react';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Box from '@mui/material/Box';
import participantStatus from '../util/participantStatus';
import cryptoBrowserify from 'crypto-browserify';

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
      case 'register':
        args.push(this.state.name);
        break;
      case 'registerWithEncryption': {
        args.push(this.state.name);
        const encryptedData = cryptoBrowserify.publicEncrypt(
          this.state.detail.encryption,
          Buffer.from(this.state.full_name, 'utf-8')
        );
        args.push(encryptedData.toString('hex'));
        break;
      }
      default:
        break;
    }
    if (actionName == 'register' || actionName == 'registerWithEncryption') {
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
    });
    this.props.eventEmitter.emit('attendees', []);
  }

  handleSelect(event) {
    this.setState({
      address: event.target.value,
    });
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
    this.setState({
      name: e.target.value,
    });
  }

  handleEncryptedField(e) {
    this.setState({
      full_name: e.target.value,
    });
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

    let encryptionField = null;
    var availableSpots = this.state.detail.limitOfParticipants - this.state.detail.registered;
    if (this.props.read_only) {
      registerButton = <span>Connect via Mist/Metamask to be able to register.</span>;
    } else if (this.state.accounts.length > 0) {
      if (this.state.detail.ended) {
        registerButton = <span>This event is over </span>;
      } else if (availableSpots <= 0) {
        registerButton = <span>No more spots left</span>;
      } else {
        let actionName = 'register';
        if (this.state.detail.encryption && this.showRegister()) {
          encryptionField = (
            <TextField
              label="Full name * (to be encrypted)"
              placeholder="Full name (required)"
              value={this.state.full_name || ''}
              onChange={this.handleEncryptedField.bind(this)}
              variant="outlined"
              size="small"
              sx={{ margin: '0 5px' }}
            />
          );
          actionName = 'registerWithEncryption';
        }
        registerButton = (
          <Button
            variant="contained"
            color={this.showRegister() ? 'secondary' : 'inherit'}
            disabled={!this.showRegister()}
            style={buttonStyle}
            onClick={this.handleAction.bind(this, actionName)}
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
      nameField = (
        <TextField
          placeholder="@twitter_handle (required)"
          label="Twitter handle *"
          value={this.state.name || ''}
          onChange={this.handleName.bind(this)}
          variant="outlined"
          size="small"
          sx={{ margin: '0 5px' }}
        />
      );
    }

    return (
      <Paper elevation={1} sx={{ padding: 2 }}>
        <Box component="form" sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}>
          {encryptionField}
          {nameField}
          <FormControl sx={{ minWidth: '25em', margin: '0 5px' }} size="small">
            <InputLabel id="account-select-label">Account address</InputLabel>
            <Select
              labelId="account-select-label"
              value={this.state.address || ''}
              onChange={this.handleSelect.bind(this)}
              label="Account address"
            >
              {this.state.accounts.map((account, index) => (
                <MenuItem key={index} value={account}>
                  {account}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {registerButton}
          {withdrawButton}
          {attendButton}
          {adminButtons}
        </Box>
        {warningText}
      </Paper>
    );
  }
}

export default FormInput;
