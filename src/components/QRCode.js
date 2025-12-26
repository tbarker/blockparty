import React from 'react';
import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';

class QRCode extends React.Component {
  constructor(props) {
    super(props);
  }

  handleSearchField(_event){
    web3.currentProvider
      .scanQRCode()
      .then(data => {
        console.log('QR Scanned:', data);
        this.props.eventEmitter.emit('search', data);
      })
      .catch(err => {
        console.log('Error:', err);
      });
  }

  render() {
    if(typeof web3 !== 'undefined' && web3.currentProvider && web3.currentProvider.scanQRCode){
      return (
        <IconButton onClick={this.handleSearchField.bind(this)}>
          {/* from https://materialdesignicons.com */}
          <Avatar src={require('../images/qrcode-scan.png')} sx={{ width: 26, height: 26, bgcolor: 'white' }} />
        </IconButton>
      );
    }else{
      return null;
    }
  }
}
export default QRCode;
