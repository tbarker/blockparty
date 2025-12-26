import React from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

export default class Instruction extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      open: false
    };
  }

  componentDidMount(){
    this.props.eventEmitter.on('instruction', () => {
      this.handleOpen();
    });
  }

  handleOpen(){
    this.setState({open: true});
  }

  handleClose(){
    this.setState({open: false});
  }

  render(){
    return (
      <Dialog
        open={this.state.open}
        onClose={this.handleClose.bind(this)}
        maxWidth="lg"
        fullWidth
        scroll="paper"
      >
        <DialogTitle>Welcome to BlockParty</DialogTitle>
        <DialogContent dividers>
          <Box>
            <Typography variant="h5" gutterBottom>What is this?</Typography>
            <Typography paragraph>
              Have you ever encountered free party or meetup and realised that half the people registered did not actually turn up?
              BlockParty solves this problem by providing a simple incentive for people to register only if they mean it.
            </Typography>

            <Typography variant="h5" gutterBottom>How does this work?</Typography>
            <Typography paragraph>
              Simple. You pay small deposit when you register. You lose your deposit if you do not turn up. You will get your deposit back + we split the deposit of whom did not turn up.
              You go to party and may end up getting more money.
            </Typography>
            <Box sx={{ textAlign: 'center' }}>
              <img style={{ width: '50%', margin: '25px' }} src={require('../images/diagram.png')} alt="How it works diagram" />
            </Box>

            <Typography variant="h5" gutterBottom>Demo</Typography>
            <Box sx={{ textAlign: 'center' }} className="video-container">
              <iframe width="560" height="315" src="https://www.youtube.com/embed/YkFGPokK0eQ" frameBorder="0" allowFullScreen title="Demo video"></iframe>
            </Box>

            <Typography variant="h5" gutterBottom>Targetted users</Typography>
            <Typography paragraph>
              The current users are mostly participants of Blockchain related events, such as conference pre/post dinner, meetups, and hackathons. The users are expected to own some Ether (a virtual currency, shorten for ETH), to pay the deposit of the event, as well as usage fee of its platform called [Ethereum](http://ethereum.org).
            </Typography>

            <Typography variant="h5" gutterBottom>How to setup</Typography>

            <Typography variant="h6" gutterBottom>Option 1: access from mobile browser</Typography>
            <Typography paragraph>
              This is the recommended way. The easier step by step guide is <a href='https://medium.com/@makoto_inoue/participating-blockparty-event-with-a-mobile-wallet-b6b9123246f7'>here</a>
            </Typography>
            <ul>
              <li>Step 1: Download <a href='http://status.im'>Status.im</a>, <a href='https://www.cipherbrowser.com'>Cipher Browser</a> or <a href='https://trustwalletapp.com'>Trust Wallet</a> from App store/Google play</li>
              <li>Step 2: Create an account on your wallet, and make sure you have some Ether.</li>
              <li>Step 3: Type the event url on their built in browser</li>
            </ul>

            <Typography variant="h6" gutterBottom>Option 2: access from desktop browser with <a href='https://metamask.io/'>Metamask</a> Chrome extension</Typography>
            <Typography paragraph>This is the most popular way right now.</Typography>
            <ul>
              <li>Step 1: Install <a href='https://metamask.io/'>Metamask</a> Chrome extension</li>
              <li>Step 2: Create an account on your metamask, and make sure you have some Ether.</li>
              <li>Step 3: Refresh the page</li>
            </ul>

            <Typography variant="h6" gutterBottom>Option 3: access from normal browser connecting to local node</Typography>
            <Typography paragraph>This has been the standard way to access Dapp prior to Ethereum Wallet (lower than v 0.7)</Typography>
            <ul>
              <li>Step 1: Install <a href='https://github.com/ethereum/mist/releases'>Mist browser (v 0.8 or higher)</a>, and make sure you choose <strong>mainnet</strong>. Here is <a href='https://www.youtube.com/watch?v=Y3JfLgjqNU4'>a quick video tutorial</a></li>
              <li>Step 2: Create an account on your wallet, and make sure you have some Ether.</li>
              <li>Step 3: Stop Ethereum Wallet</li>
              <li>Step 4: Start geth(Go Etheruem, command line tool) with the following options. (See the <a href='https://github.com/ethereum/go-ethereum/wiki/Building-Ethereum'>installation instructions</a> for each platform)</li>
              <li>Step 5: Refresh this page</li>
            </ul>
            <Box component="blockquote" sx={{ backgroundColor: 'black', color: 'white', padding: '1em' }}>
              geth --unlock 0 --rpc --rpcapi &quot;eth,net,web3&quot; --rpccorsdomain URL
            </Box>
            <Typography paragraph>
              NOTE: <Box component="span" sx={{ backgroundColor: 'black', color: 'white', padding: '0.3em' }}>--unlock 0</Box> will unlock with one account. <Box component="span" sx={{ backgroundColor: 'black', color: 'white', padding: '0.3em' }}>--unlock 0 1</Box> will unlock with two accounts.
            </Typography>

            <Typography variant="h5" gutterBottom>How to play?</Typography>
            <Typography paragraph>
              Type your twitter account, pick one of your address, then press &apos;RSVP&apos;. It will take 10 to 30 seconds to get verified and you will receive notification.
              Once registered, join the party! Your party host (the contract owner) will mark you as attend.
              Once the host clicks `payout`, then you are entitled to `withdraw` your payout.
            </Typography>

            <Typography variant="h5" gutterBottom>FAQ</Typography>

            <Typography variant="h6" gutterBottom>Can I cancel my registration?</Typography>
            <Typography paragraph>No</Typography>

            <Typography variant="h6" gutterBottom>What happens if I do not withdraw my payout?</Typography>
            <Typography paragraph>
              If you do not withdraw your payout within one week after the event is end, the host (contract owner) will clear the balance from the contract and the remaining blance goes back to the host, so do not keep them hanging
            </Typography>

            <Typography variant="h6" gutterBottom>What happens if the event is canceled?</Typography>
            <Typography paragraph>
              In case the event is canceled, all registered people can withdraw their deposit.
              Make sure that you register with correct twitter account so that the host can notify you.
            </Typography>

            <Typography variant="h6" gutterBottom>What if there is a bug in the contract!</Typography>
            <Typography paragraph>
              If the bug is found before the contract is compromised, the host can kill the contract and all the deposit goes back to the host so he/she can manually return the deposit.
              If the contract is compromised and the deposit is stolen, or his/her private key is lost/stolen, I am afraid that the host cannot compensate for you. Please assess the risk before you participate the event.
            </Typography>

            <Typography variant="h6" gutterBottom>Can I host my own event using BlockParty?</Typography>
            <Typography paragraph>
              Please contact the <a href="http://twitter.com/makoto_inoue">author of this project</a> if you are interested.
            </Typography>

            <Typography variant="h5" gutterBottom>Terms and conditions</Typography>
            <Typography paragraph>
              By accessing this website, you agree to our terms and conditions of use. We accept no responsibility whether in contract, tort or otherwise for any loss or damage arising out of or in connection with your use of our software and recommend that you ensure your devices are protected by using appropriate virus protection.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={this.handleClose.bind(this)} color="primary">
            Ok
          </Button>
        </DialogActions>
      </Dialog>
    );
  }
}
