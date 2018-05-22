const Web3 = require('web3');
const TruffleContract = require('truffle-contract');
const IdentityArtifact = require('../build/dav-js/build/contracts/Identity.json');

const ETH_NODE_URL = process.env.ETH_NODE_URL || 'http://localhost:8545';
const web3Provider = new Web3.providers.HttpProvider(ETH_NODE_URL);
const web3 = new Web3(web3Provider);

function registerNew()
{
  const davId=web3.eth.accounts.create();
  register(davId).catch(err=>{console.log(err);});
  return davId;
}

async function register(davId) {
  let contract = TruffleContract(IdentityArtifact);
  contract.setProvider(web3.currentProvider);

  let instance = await contract.deployed();
  let res = await instance.registerSimple({
    from: davId
  });
  console.log(`IdentityArtifact transaction result: ${res}`);
}

module.exports = {
  registerNew
};
