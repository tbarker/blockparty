import React from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

const WELCOME_SEEN_KEY = 'blockparty_welcome_seen';

export default class Instruction extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      open: false,
    };
  }

  componentDidMount() {
    // Listen for manual instruction triggers (e.g., About button)
    this.props.eventEmitter.on('instruction', () => {
      this.handleOpen();
    });

    // Show welcome modal on first visit only
    if (!this.hasSeenWelcome()) {
      // Wait for next paint frame to ensure the app has rendered
      requestAnimationFrame(() => {
        this.handleOpen();
      });
    }
  }

  hasSeenWelcome() {
    try {
      return localStorage.getItem(WELCOME_SEEN_KEY) === 'true';
    } catch {
      // localStorage may not be available (e.g., private browsing)
      return false;
    }
  }

  markWelcomeSeen() {
    try {
      localStorage.setItem(WELCOME_SEEN_KEY, 'true');
    } catch {
      // localStorage may not be available
    }
  }

  handleOpen() {
    this.setState({ open: true });
  }

  handleClose(event, reason) {
    // Only close via the OK button, not backdrop click or escape key
    if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
      return;
    }
    this.markWelcomeSeen();
    this.setState({ open: false });
  }

  render() {
    return (
      <Dialog
        open={this.state.open}
        onClose={this.handleClose.bind(this)}
        maxWidth="lg"
        fullWidth
        scroll="paper"
        slotProps={{
          backdrop: {
            sx: {
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
            },
          },
        }}
      >
        <DialogTitle>Welcome to BlockParty</DialogTitle>
        <DialogContent dividers>
          <Box>
            <Typography variant="h5" gutterBottom>
              What is this?
            </Typography>
            <Typography paragraph>
              Have you ever encountered free party or meetup and realised that half the people
              registered did not actually turn up? BlockParty solves this problem by providing a
              simple incentive for people to register only if they mean it.
            </Typography>

            <Typography variant="h5" gutterBottom>
              How does this work?
            </Typography>
            <Typography paragraph>
              Simple. You pay small deposit when you register. You lose your deposit if you do not
              turn up. You will get your deposit back + we split the deposit of whom did not turn
              up. You go to party and may end up getting more money.
            </Typography>
            <Box sx={{ textAlign: 'center' }}>
              <img
                style={{ width: '50%', margin: '25px' }}
                src={require('../images/diagram.png')}
                alt="How it works diagram"
              />
            </Box>

            <Typography variant="h5" gutterBottom>
              Demo
            </Typography>
            <Box sx={{ textAlign: 'center' }} className="video-container">
              <iframe
                width="560"
                height="315"
                src="https://www.youtube.com/embed/YkFGPokK0eQ"
                frameBorder="0"
                allowFullScreen
                title="Demo video"
              ></iframe>
            </Box>

            <Typography variant="h5" gutterBottom>
              Targetted users
            </Typography>
            <Typography paragraph>
              The current users are mostly participants of Blockchain related events, such as
              conference pre/post dinner, meetups, and hackathons. The users are expected to own
              some Ether (a virtual currency, shorten for ETH), to pay the deposit of the event, as
              well as usage fee of its platform called [Ethereum](http://ethereum.org).
            </Typography>

            <Typography variant="h5" gutterBottom>
              Connecting Your Wallet
            </Typography>
            <Typography paragraph>
              BlockParty supports multiple wallet options. Click the &quot;Connect Wallet&quot; button
              to get started.
            </Typography>

            <Typography variant="h6" gutterBottom>
              Supported Wallets
            </Typography>
            <ul>
              <li>
                <strong><a href="https://metamask.io/">MetaMask</a></strong> - The most popular
                browser extension wallet. Available for Chrome, Firefox, Brave, and Edge.
              </li>
              <li>
                <strong><a href="https://rainbow.me/">Rainbow</a></strong> - A fun, simple, and secure
                Ethereum wallet available as a mobile app.
              </li>
              <li>
                <strong><a href="https://www.coinbase.com/wallet">Coinbase Wallet</a></strong> - A
                self-custody wallet from Coinbase, available as browser extension and mobile app.
              </li>
              <li>
                <strong>WalletConnect</strong> - Connect any mobile wallet that supports WalletConnect
                by scanning a QR code. This includes Trust Wallet, Argent, imToken, and many others.
              </li>
            </ul>

            <Typography variant="h6" gutterBottom>
              Desktop Setup (Recommended)
            </Typography>
            <ol>
              <li>Install your preferred wallet browser extension (MetaMask, Coinbase Wallet, or Rainbow)</li>
              <li>Create an account and securely store your recovery phrase</li>
              <li>Add some ETH to your wallet for transaction fees and deposits</li>
              <li>Click the &quot;Connect Wallet&quot; button on this page</li>
              <li>Select your wallet and approve the connection</li>
            </ol>

            <Typography variant="h6" gutterBottom>
              Mobile Setup
            </Typography>
            <ol>
              <li>Download a WalletConnect-compatible wallet (Rainbow, Trust Wallet, MetaMask Mobile, etc.)</li>
              <li>Create an account and fund it with some ETH</li>
              <li>Click &quot;Connect Wallet&quot; and select WalletConnect</li>
              <li>Scan the QR code with your mobile wallet</li>
              <li>Approve the connection in your wallet app</li>
            </ol>

            <Typography variant="h5" gutterBottom>
              How to play?
            </Typography>
            <Typography paragraph>
              Type your twitter account, pick one of your address, then press &apos;RSVP&apos;. It
              will take 10 to 30 seconds to get verified and you will receive notification. Once
              registered, join the party! Your party host (the contract owner) will mark you as
              attend. Once the host clicks `payout`, then you are entitled to `withdraw` your
              payout.
            </Typography>

            <Typography variant="h5" gutterBottom>
              FAQ
            </Typography>

            <Typography variant="h6" gutterBottom>
              Can I cancel my registration?
            </Typography>
            <Typography paragraph>No</Typography>

            <Typography variant="h6" gutterBottom>
              What happens if I do not withdraw my payout?
            </Typography>
            <Typography paragraph>
              If you do not withdraw your payout within one week after the event is end, the host
              (contract owner) will clear the balance from the contract and the remaining blance
              goes back to the host, so do not keep them hanging
            </Typography>

            <Typography variant="h6" gutterBottom>
              What happens if the event is canceled?
            </Typography>
            <Typography paragraph>
              In case the event is canceled, all registered people can withdraw their deposit. Make
              sure that you register with correct twitter account so that the host can notify you.
            </Typography>

            <Typography variant="h6" gutterBottom>
              What if there is a bug in the contract!
            </Typography>
            <Typography paragraph>
              If the bug is found before the contract is compromised, the host can kill the contract
              and all the deposit goes back to the host so he/she can manually return the deposit.
              If the contract is compromised and the deposit is stolen, or his/her private key is
              lost/stolen, I am afraid that the host cannot compensate for you. Please assess the
              risk before you participate the event.
            </Typography>

            <Typography variant="h6" gutterBottom>
              Can I host my own event using BlockParty?
            </Typography>
            <Typography paragraph>
              Please contact the{' '}
              <a href="http://twitter.com/makoto_inoue">author of this project</a> if you are
              interested.
            </Typography>

            <Typography variant="h5" gutterBottom>
              Terms and conditions
            </Typography>
            <Typography paragraph>
              By accessing this website, you agree to our terms and conditions of use. We accept no
              responsibility whether in contract, tort or otherwise for any loss or damage arising
              out of or in connection with your use of our software and recommend that you ensure
              your devices are protected by using appropriate virus protection.
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
