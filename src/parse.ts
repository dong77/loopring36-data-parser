const Web3 = require("web3"); // tslint:disable-line
const PrivateKeyProvider = require("truffle-privatekey-provider");
import { Bitstream } from "./bitstream";
import * as BN from "bn.js";
const assert = require("assert");
const InputDataDecoder = require('ethereum-input-data-decoder');
import {
  BlockContext,
  TransactionType
} from "./types";
import { DepositProcessor } from "./request_processors/deposit_processor";
import { AccountUpdateProcessor } from "./request_processors/account_update_processor";
import { TransferProcessor } from "./request_processors/transfer_processor";
import { WithdrawalProcessor } from "./request_processors/withdrawal_processor";
import { AmmUpdateProcessor } from "./request_processors/amm_update_processor";
import { SpotTradeProcessor } from "./request_processors/spot_trade_processor";

const testAccountPrivKey = "80fc4b4b75850d8c0958b341bb8eae1f79819a00902d3744aa02eb8c7b9cb190";
const infuraUrlMain = "https://mainnet.infura.io/v3/a06ed9c6b5424b61beafff27ecc3abf3";
const provider = new PrivateKeyProvider(testAccountPrivKey, infuraUrlMain);
const web3 = new Web3(provider);

async function parseLoopringSubmitBlocksTx(transaction: any) {

    const decodedInput = web3.eth.abi.decodeParameters(
      [
        "bool",
        "bytes",
        "bytes"
      ],
      "0x" + transaction.input.slice(2 + 4 * 2)
    );

    const data = decodedInput[1];
    // Get the inputs to commitBlock
    const decodedInputs = web3.eth.abi.decodeParameters(
      [
        {
          "struct ExchangeData.Block[]": {
            blockType: "uint8",
            blockSize: "uint16",
            blockVersion: "uint8",
            data: "bytes",
            proof: "uint256[8]",
            storeDataHashOnchain: "bool",
            auxiliaryData: "bytes",
            offchainData: "bytes"
          }
        }
      ],
      "0x" +
        data /*transaction.input*/
        .slice(2 + 4 * 2)
    );
    //console.log(decodedInputs);
    const numBlocks = decodedInputs[0].length;
    //console.log("numBlocks: " + numBlocks);
    for (let i = 0; i < numBlocks; i++) {
      // Get the block data
      const blockType = parseInt(decodedInputs[0][i].blockType);
      const blockSize = parseInt(decodedInputs[0][i].blockSize);
      const blockVersion = parseInt(decodedInputs[0][i].blockVersion);
      const onchainData = decodedInputs[0][i].data;
      const offchainData = decodedInputs[0][i].offchainData;
      const data = decodedInputs[4] === null ? "0x" : onchainData;

      // Get the new Merkle root
      const bs = new Bitstream(data);
      if (bs.length() < 20 + 32 + 32) {
        // console.log("Invalid block data: " + data);
        return;
      }

      const merkleRoot = bs.extractUint(20 + 32);
      // console.log("merkleRoot: " + merkleRoot);

      // Create the block
      const newBlock = {
        blockIdx: i,
        blockType,
        blockSize,
        blockVersion,
        data,
        offchainData,
        origin: transaction.from,
        blockFee: new BN(0).toString(),
        merkleRoot,
        timestamp: 0,
        numRequestsProcessed: 0,
        totalNumRequestsProcessed: 0,
      };

      // console.log("newBlock:", newBlock);
      return processBlock(newBlock);
    }

}

function processBlock(block: any) {
  let requests: any[] = [];

  let data = new Bitstream(block.data);
  let offset = 0;

  // General data
  offset += 20 + 32 + 32 + 4;
  const protocolFeeTakerBips = data.extractUint8(offset);
  offset += 1;
  const protocolFeeMakerBips = data.extractUint8(offset);
  offset += 1;
  const numConditionalTransactions = data.extractUint32(offset);
  offset += 4;
  const operatorAccountID = data.extractUint32(offset);
  offset += 4;

  const ctx: BlockContext = {
    protocolFeeTakerBips,
    protocolFeeMakerBips,
    operatorAccountID
  };

  for (let i = 0; i < block.blockSize; i++) {
    const size1 = 29;
    const size2 = 39;
    const txData1 = data.extractData(offset + i * size1, size1);
    const txData2 = data.extractData(
      offset + block.blockSize * size1 + i * size2,
      size2
    );
    const txData = new Bitstream(txData1 + txData2);

    const txType = txData.extractUint8(0);

    let request: any = {};
    if (txType === TransactionType.NOOP) {
      // Do nothing
    } else if (txType === TransactionType.DEPOSIT) {
      request = DepositProcessor.extractData(txData);
    } else if (txType === TransactionType.TRANSFER) {
      request = TransferProcessor.extractData(txData);
    } else if (txType === TransactionType.WITHDRAWAL) {
      request = WithdrawalProcessor.extractData(txData);
    } else if (txType === TransactionType.ACCOUNT_UPDATE) {
      request = AccountUpdateProcessor.extractData(txData);
    } else if (txType === TransactionType.AMM_UPDATE) {
      request = AmmUpdateProcessor.extractData(txData);
    } else if (txType === TransactionType.SPOT_TRADE) {
      request = SpotTradeProcessor.extractData(txData);
    } else {
      // assert(false, "unknown transaction type: " + txType);
      console.log("unknown transaction type: " + txType, "; txData:", txData.getData());
    }
    request.type = TransactionType[txType];
    // request.txData = txData.getData();

    requests.push(request);
  }

  return requests;
}

export { parseLoopringSubmitBlocksTx};
