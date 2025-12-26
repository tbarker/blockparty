import React from 'react';
import TextField from '@mui/material/TextField';

class NameSearch extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      keyword: ''
    };
  }

  componentDidMount(){
    this.props.eventEmitter.on('search', keyword => {
      this.setState({ keyword: keyword || '' });
    });
  }

  handleSearchField(event){
    this.props.eventEmitter.emit('search', event.target.value);
  }

  render() {
    return (
      <TextField
        label="Search by name or address"
        value={this.state.keyword}
        onChange={this.handleSearchField.bind(this)}
        variant="outlined"
        size="small"
        sx={{ margin: '0 5px' }}
      />
    );
  }
}
export default NameSearch;
