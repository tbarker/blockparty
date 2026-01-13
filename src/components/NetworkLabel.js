import React from 'react';
import Button from '@mui/material/Button';

/**
 * Get network display info based on chain ID
 */
function getNetworkInfo(chainId) {
  switch (chainId?.toString()) {
    case '1':
      return { color: 'green', text: 'MAINNET' };
    case '11155111':
      return { color: 'orange', text: 'SEPOLIA' };
    case '5':
      return { color: 'orange', text: 'GOERLI' };
    case '1337':
      return { color: 'orange', text: 'LOCALHOST' };
    default:
      return { color: 'orange', text: 'TESTNET' };
  }
}

export default class NetworkLabel extends React.Component {
  constructor(props) {
    super(props);
    if (props.read_only) {
      this.state = {
        color: 'red',
        text: 'READONLY',
      };
    } else if (props.chainId) {
      // Use chainId prop if available (from wagmi)
      const info = getNetworkInfo(props.chainId);
      this.state = {
        color: info.color,
        text: info.text,
      };
    } else {
      this.state = {
        color: null,
        text: null,
      };
    }

    // Also listen to event emitter for backward compatibility
    if (!props.read_only && props.eventEmitter) {
      this.props.eventEmitter.on('network', obj => {
        var color = 'orange';
        if (obj.name == 'MAINNET') color = 'green';
        this.setState({
          color: color,
          text: obj.name,
        });
      });
    }
  }

  componentDidUpdate(prevProps) {
    // Update state when chainId prop changes
    if (this.props.chainId !== prevProps.chainId && !this.props.read_only) {
      const info = getNetworkInfo(this.props.chainId);
      this.setState({
        color: info.color,
        text: info.text,
      });
    }
  }

  render() {
    if (!this.state.text) {
      return null;
    }
    return (
      <Button
        sx={{
          backgroundColor: this.state.color,
          color: 'white',
          '&:hover': {
            backgroundColor: this.state.color,
          },
          '&.Mui-disabled': {
            backgroundColor: this.state.color,
            color: 'white',
          },
        }}
        disabled
      >
        {this.state.text}
      </Button>
    );
  }
}
