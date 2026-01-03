import React from 'react';
import Button from '@mui/material/Button';

export default class NetworkLabel extends React.Component {
  constructor(props) {
    super(props);
    if (props.read_only) {
      this.state = {
        color: 'red',
        text: 'READONLY',
      };
    } else {
      this.state = {
        color: null,
        text: null,
      };
    }

    if (!props.read_only) {
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
