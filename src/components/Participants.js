import React from 'react';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Avatar from '@mui/material/Avatar';
import Checkbox from '@mui/material/Checkbox';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { round } from 'mathjs';
import participantStatus from '../util/participantStatus';
import NameSearch from './NameSearch';
import QRCode from './QRCode';

const getTwitterIcon = name => (
  <Avatar
    sx={{ verticalAlign: 'middle', width: 26, height: 26, display: 'inline-flex' }}
    src={`https://avatars.io/twitter/${name}`}
  />
);

const styles = {
  paperRight: {
    flex: 3,
    textAlign: 'center',
  },
};

class Participants extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      accounts: [],
      keyword: null,
      address: null,
      participants: [],
      attendees: [],
      detail: {},
      etherscan_url: null,
    };
  }

  componentDidMount() {
    // Initialize
    this.props.getParticipants(participants => {
      this.setState({ participants });
    });

    this.props.eventEmitter.on('search', keyword => {
      this.setState({ keyword: keyword });
    });

    this.props.eventEmitter.on('change', _ => {
      this.props.getParticipants(participants => {
        this.setState({ participants });
      });
    });
    this.props.eventEmitter.on('accounts_received', accounts => {
      this.setState({
        address: accounts[0],
        accounts: accounts,
      });
    });
    this.props.eventEmitter.on('detail', detail => {
      this.setState({ detail: detail });
    });

    this.props.eventEmitter.on('network', network => {
      this.setState({
        etherscan_url: network.etherscan_url,
      });
    });
    this.props.eventEmitter.on('attendees', attendees => {
      // Resets after clicking 'attend' button.
      if (attendees.length != this.state.attendees.length) {
        this.setState({
          attendees: [],
        });
      }
    });
  }

  isAdmin() {
    return (
      (this.state.detail.admins && this.state.detail.admins.includes(this.state.address)) ||
      this.state.detail.owner == this.state.address
    );
  }

  isUser(participant) {
    return this.state.accounts.includes(participant.address);
  }

  toNumber(value) {
    if (value) return value.toNumber();
  }

  handleSearchField(event) {
    this.setState({
      keyword: event.target.value,
    });
  }

  handleAttendees(participantAddress, event) {
    const isInputChecked = event.target.checked;
    let updatedAttendees;
    if (isInputChecked) {
      updatedAttendees = [...this.state.attendees, participantAddress];
    } else {
      updatedAttendees = this.state.attendees.filter(function (a) {
        return a != participantAddress;
      });
    }
    this.setState({ attendees: updatedAttendees });
    this.props.eventEmitter.emit('attendees', updatedAttendees);
    return true;
  }

  yesNo(participant) {
    if (participant.attended) {
      return 'Yes';
    } else {
      if (this.isAdmin() && !this.state.detail.ended) {
        return <Checkbox onChange={this.handleAttendees.bind(this, participant.address)} />;
      } else {
        return '';
      }
    }
  }

  displayBalance(participant) {
    var message = participantStatus(participant, this.state.detail);
    let color, amount;
    switch (message) {
      case 'Won':
      case 'Withdrawn':
        color = 'green';
        amount = web3.utils.fromWei(this.state.detail.payoutAmount.toString(), 'ether');
        break;
      case 'Cancelled':
        color = 'red';
        amount = 0;
        break;
      case 'Lost':
        color = 'red';
        amount = 0;
        break;
      default:
        color = 'black';
        amount = 0;
    }
    let amountToDisplay;
    if (amount != 0) {
      amountToDisplay = round(amount, 3).toString();
    }

    return (
      <span style={{ color: color }}>
        {amountToDisplay} {message}
      </span>
    );
  }

  displayParticipants() {
    if (!this.state.detail.name)
      return (
        <TableRow>
          <TableCell colSpan={3}>
            <Box>
              <Typography variant="h6">No info available.</Typography>
              <Typography>The reason are more likely to be one of the followings.</Typography>
              <ul>
                <li>You are not connected to the correct Ethereum network with correct options.</li>
                <li>
                  Your local node is out of sync (may take a few hours if this is your first time
                  using Ethereum).
                </li>
              </ul>
              <Typography>
                Please follow the instructions at &apos;About&apos; page to solve.
              </Typography>
            </Box>
          </TableCell>
        </TableRow>
      );
    if (this.state.participants.length > 0) {
      var state = this.state;
      return this.state.participants.map(participant => {
        if (state.keyword && state.keyword.length >= 3) {
          let keyword = state.keyword.toLowerCase();
          participant.matched =
            !!participant.name.match(keyword) || !!participant.address.match(keyword);
        } else {
          participant.matched = true;
        }
        let isAdmin =
          state.detail.admins &&
          state.detail.admins.filter(admin => {
            return admin == participant.address;
          }).length > 0;
        if (isAdmin || state.detail.owner == participant.address) {
          participant.role = '*';
        }

        var participantAddress;
        if (this.state.etherscan_url) {
          let display;
          if (participant.ensname) {
            display = participant.ensname;
          } else {
            display = participant.address.slice(0, 5);
          }
          participantAddress = (
            <a
              target="_blank"
              href={`${this.state.etherscan_url}/address/${participant.address}`}
              rel="noreferrer"
            >
              {display}...
            </a>
          );
        } else {
          participantAddress = `${participant.address.slice(0, 5)}...`;
        }
        let rowStyle = {};
        if (!participant.matched) {
          rowStyle.display = 'none';
        }
        return (
          <TableRow key={participant.address} style={rowStyle}>
            <TableCell>
              {getTwitterIcon(participant.name)}
              <span style={{ paddingLeft: '1em' }}>
                <a
                  target="_blank"
                  href={`https://twitter.com/${participant.name}`}
                  rel="noreferrer"
                >
                  {participant.role}
                  {participant.name}
                </a>{' '}
              </span>
              ({participantAddress})
            </TableCell>
            <TableCell>{this.yesNo(participant)}</TableCell>
            <TableCell>
              <span>{this.displayBalance(participant)}</span>
            </TableCell>
          </TableRow>
        );
      });
    } else {
      return (
        <TableRow>
          <TableCell colSpan={3} style={{ textAlign: 'center' }}>
            No one has registered yet. Be the first to register by typing your twitter handle and
            press &apos;Register&apos;
          </TableCell>
        </TableRow>
      );
    }
  }

  render() {
    return (
      <Paper elevation={1} style={styles.paperRight} sx={{ padding: 2 }}>
        <Typography variant="h6">Participants</Typography>

        <Box sx={{ marginBottom: 2 }}>
          <NameSearch eventEmitter={this.props.eventEmitter} />
          <QRCode eventEmitter={this.props.eventEmitter} />
        </Box>

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: '50%' }}>Name</TableCell>
                <TableCell sx={{ width: '20%' }}>Attended</TableCell>
                <TableCell sx={{ width: '30%' }}>Payout</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>{this.displayParticipants()}</TableBody>
          </Table>
        </TableContainer>
        <Typography variant="caption" sx={{ color: 'grey', marginTop: 1, display: 'block' }}>
          Note: admins are marked as *
        </Typography>
      </Paper>
    );
  }
}
export default Participants;
