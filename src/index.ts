const Web3 = require("web3");

const mongo = require("mongodb");

const awsGeth =
  "ws://ec2-13-250-42-164.ap-southeast-1.compute.amazonaws.com:8545";
const infura = "wss://mainnet.infura.io/ws/v3/3cdee1310ccc4e9fbb19bf8d9967358e";

const startBlock = 11763791;
const exchangeOwner = "0x42bc1ab51b7af89cfaa88a7291ce55971d8cb83a";
const exchangeV3 = "0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4";

const oprator7 = "0xa921af7e4dd279e1325399e4e3bf13d0e57f48fc";
const eventBlockSubmitted =
  "0xcc86d9ed29ebae540f9d25a4976d4da36ea4161b854b8ecf18f491cf6b0feb5c";

let web3 = new Web3(Web3.givenProvider || infura);
const BN = web3.utils.BN;

const { parseLoopringSubmitBlocksTx } = require("./parse.ts");

const MongoClient = require("mongodb").MongoClient;
const dbUrl =
  "mongodb+srv://localhost:27017/";
const client = new MongoClient(dbUrl);

// client.connect();

  const onEvent = async (error, event) => {
    const block = await web3.eth.getBlock(event.blockNumber);
    const tx = await web3.eth.getTransaction(event.transactionHash);

    const dexBlock = { ...event, ...tx };

    dexBlock.dexBlockIndex = parseInt(
      new BN(dexBlock.topics[1].substring(2)).toString()
    );
    dexBlock.dexMerkelRoot = dexBlock.data.substring(0, 64 + 2);
    dexBlock.dexPublicDataHash = "0x" + dexBlock.data.substring(66);
    dexBlock.timestamp = block.timestamp;

    delete dexBlock.input;
    delete dexBlock.hash;
    delete dexBlock.data;
    delete dexBlock.topics;
    delete dexBlock.id;
    delete dexBlock.nonce;
    delete dexBlock.value;
    delete dexBlock.r;
    delete dexBlock.s;
    delete dexBlock.v;
    delete dexBlock.removed;
    delete dexBlock.logIndex;
    delete dexBlock.transactionIndex;
    delete dexBlock.address;
    delete dexBlock.to;
    delete dexBlock.from;

      // const options = { upsert: true };

   // await client.db.collection("blocks").updateOne(dexBlock, function (err, res) {
      // if (err) throw err;
      console.log(dexBlock);
      console.log("--------------------");
    // });

    const txs = await parseLoopringSubmitBlocksTx(tx);

   // await client.db.collection("transactions").inserMany(txs, function(err, res) {
      // if (err) throw err;
      console.log(txs);
      console.log("==================");
    // });
  };

  var subscription = web3.eth.subscribe(
    "logs",
    {
      fromBlock: startBlock,
      address: exchangeV3,
      topics: [eventBlockSubmitted],
    },
    onEvent
  );
