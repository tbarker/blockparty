import React from 'react';
import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';

class QRCode extends React.Component {
  constructor(props) {
    super(props);
  }

  handleSearchField(_event) {
    // Check for mobile wallet QR scanner support
    if (window.ethereum && window.ethereum.scanQRCode) {
      window.ethereum
        .scanQRCode()
        .then(data => {
          console.log('QR Scanned:', data);
          this.props.eventEmitter.emit('search', data);
        })
        .catch(err => {
          console.log('Error:', err);
        });
    }
  }

  render() {
    // Only show QR button if the provider supports scanning
    if (typeof window !== 'undefined' && window.ethereum && window.ethereum.scanQRCode) {
      return (
        <IconButton onClick={this.handleSearchField.bind(this)}>
          {/* from https://materialdesignicons.com */}
          <Avatar
            src={require('../images/qrcode-scan.png')}
            sx={{ width: 26, height: 26, bgcolor: 'white' }}
          />
        </IconButton>
      );
    } else {
      return null;
    }
  }
}
export default QRCode;
