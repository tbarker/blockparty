import React from 'react';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Avatar from '@mui/material/Avatar';
import PeopleIcon from '@mui/icons-material/People';
import EventIcon from '@mui/icons-material/Event';
import PlaceIcon from '@mui/icons-material/Place';
import DirectionsIcon from '@mui/icons-material/Directions';

const getEtherIcon = () => (
  <Avatar
    src={require('../images/ethereum.ico')}
    sx={{ width: 26, height: 26, bgcolor: 'white' }}
  />
);

const styles = {
  paperLeft: {
    flex: 2,
    height: '100%',
    textAlign: 'left',
    padding: 10,
  },
  list: {
    float: 'right',
    color: 'grey',
    marginRight: 1,
  },
};

class ConferenceDetail extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      etherscan_url: null,
    };
  }

  componentDidMount() {
    // Initialize
    this.props.eventEmitter.on('detail', detail => {
      this.setState(detail);
    });

    this.props.eventEmitter.on('network', network => {
      this.setState({
        etherscan_url: network.etherscan_url,
      });
    });

    // If the app failed to get detail from contract (meaning either connecting
    // to wrong network or the contract id does not match to the one deployed),
    // it will show instruction page.
    setTimeout(
      function () {
        if (typeof this.state.name == 'undefined') {
          this.props.eventEmitter.emit('instruction');
        }
      }.bind(this),
      5000
    );
  }

  toEther(value) {
    if (value) {
      // Web3 v1.x uses web3.utils.fromWei
      return this.props.web3.utils.fromWei(value.toString(), 'ether');
    }
  }

  toNumber(value) {
    if (value === null || value === undefined) return 0;
    // Handle ethers.js v6 BigInt, legacy BigNumber, or plain numbers
    if (typeof value === 'bigint') return Number(value);
    if (typeof value.toNumber === 'function') return value.toNumber();
    return Number(value);
  }

  getNameContent(name, contractAddress) {
    // Handle undefined/null contractAddress
    const address = contractAddress || '';
    const shortAddress = address ? `${address.slice(0, 5)}...` : 'Unknown';

    if (name) {
      if (this.state.etherscan_url && address) {
        return (
          <span style={styles.list}>
            {name} (
            <a
              target="_blank"
              href={`${this.state.etherscan_url}/address/${address}`}
              rel="noreferrer"
            >
              {shortAddress}
            </a>
            )
          </span>
        );
      } else {
        return (
          <span style={styles.list}>
            {name} ({shortAddress})
          </span>
        );
      }
    } else {
      return (
        <span style={styles.list}>
          {address ? `The contract ${address.slice(0, 10)}... not available` : 'Loading...'}
        </span>
      );
    }
  }

  getDateContent(name) {
    if (name) {
      return <span style={styles.list}>{name}</span>;
    } else if (this.state.metadataPending) {
      return <span style={{ ...styles.list, fontStyle: 'italic', color: '#999' }}>Loading...</span>;
    } else {
      return <span style={styles.list}>No info available</span>;
    }
  }

  getDepositContent(deposit) {
    if (deposit) {
      return <span style={styles.list}> ETH {this.toEther(deposit)}</span>;
    } else {
      return <span style={styles.list}>No info available</span>;
    }
  }

  render() {
    let attendancyStatus;
    if (this.state.ended) {
      attendancyStatus = (
        <span>
          Attended<span style={styles.list}>{this.toNumber(this.state.attended)}</span>
        </span>
      );
    } else {
      attendancyStatus = (
        <span>
          Going (spots left)
          <span style={styles.list}>
            {this.toNumber(this.state.registered)}(
            {this.toNumber(this.state.limitOfParticipants) - this.toNumber(this.state.registered)})
          </span>
        </span>
      );
    }

    return (
      <Paper elevation={1} style={styles.paperLeft}>
        <h4 style={{ textAlign: 'center' }}>Event Info</h4>
        <List>
          <ListItem>
            <ListItemText
              primary={
                <span>Name{this.getNameContent(this.state.name, this.props.contractAddress)}</span>
              }
            />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <EventIcon />
            </ListItemIcon>
            <ListItemText primary={<span>Date{this.getDateContent(this.state.date)}</span>} />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <PlaceIcon />
            </ListItemIcon>
            <ListItemText
              primary={
                <span>
                  Location
                  {this.state.location_text ? (
                    <span style={styles.list}>
                      <a target="_blank" href={this.state.map_url} rel="noreferrer">
                        {this.state.location_text}
                      </a>
                    </span>
                  ) : this.state.metadataPending ? (
                    <span style={{ ...styles.list, fontStyle: 'italic', color: '#999' }}>
                      Loading...
                    </span>
                  ) : (
                    <span style={styles.list}>No info available</span>
                  )}
                </span>
              }
            />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <DirectionsIcon />
            </ListItemIcon>
            <ListItemText
              primary={
                <span>
                  Description
                  {this.state.description_text ? (
                    <span
                      style={styles.list}
                      dangerouslySetInnerHTML={{ __html: this.state.description_text }}
                    />
                  ) : this.state.metadataPending ? (
                    <span style={{ ...styles.list, fontStyle: 'italic', color: '#999' }}>
                      Loading...
                    </span>
                  ) : (
                    <span style={styles.list}>No info available</span>
                  )}
                </span>
              }
            />
          </ListItem>
          <ListItem>
            <ListItemIcon>{getEtherIcon()}</ListItemIcon>
            <ListItemText
              primary={<span>Deposit{this.getDepositContent(this.state.deposit)}</span>}
            />
          </ListItem>
          <Divider />
          <ListItem>
            <ListItemIcon>{getEtherIcon()}</ListItemIcon>
            <ListItemText
              primary={
                <span>
                  Pot<span style={styles.list}>{this.toEther(this.state.totalBalance)}</span>
                </span>
              }
            />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <PeopleIcon />
            </ListItemIcon>
            <ListItemText primary={attendancyStatus} />
          </ListItem>
        </List>
      </Paper>
    );
  }
}

export default ConferenceDetail;
