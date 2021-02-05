const Web3 = require('web3')
import { TransactionType } from './types'
const mongo = require('mongodb')

const awsGeth =
  'ws://ec2-13-250-42-164.ap-southeast-1.compute.amazonaws.com:8545'
const infura = 'wss://mainnet.infura.io/ws/v3/3cdee1310ccc4e9fbb19bf8d9967358e'

const startBlock = 11763791
const exchangeOwner = '0x42bc1ab51b7af89cfaa88a7291ce55971d8cb83a'
const exchangeV3 = '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4'

const oprator7 = '0xa921af7e4dd279e1325399e4e3bf13d0e57f48fc'
const eventBlockSubmitted =
  '0xcc86d9ed29ebae540f9d25a4976d4da36ea4161b854b8ecf18f491cf6b0feb5c'

let web3 = new Web3(Web3.givenProvider || infura)
const BN = web3.utils.BN

const { parseLoopringSubmitBlocksTx } = require('./parse.ts')

const MongoClient = require('mongodb').MongoClient
const dbUrl = 'mongodb://localhost:27017/'
const client = new MongoClient(dbUrl)
const dbname = 'explorer4'

const zeroAddr = '0x0000000000000000000000000000000000000000'

const onEvent = async (error, event) => {
  const block = await web3.eth.getBlock(event.blockNumber)
  const tx = await web3.eth.getTransaction(event.transactionHash)

  const dexBlock = { ...event, ...tx }

  dexBlock._id = parseInt(new BN(dexBlock.topics[1].substring(2)).toString())
  dexBlock.dexMerkelRoot = dexBlock.data.substring(0, 64 + 2)
  dexBlock.dexPublicDataHash = '0x' + dexBlock.data.substring(66)
  dexBlock.timestamp = block.timestamp

  delete dexBlock.input
  delete dexBlock.hash
  delete dexBlock.data
  delete dexBlock.topics
  delete dexBlock.id
  delete dexBlock.nonce
  delete dexBlock.value
  delete dexBlock.r
  delete dexBlock.s
  delete dexBlock.v
  delete dexBlock.removed
  delete dexBlock.logIndex
  delete dexBlock.transactionIndex
  delete dexBlock.address
  delete dexBlock.to
  delete dexBlock.from

  const query = { _id: dexBlock._id }
  const update = { $set: dexBlock }
  const options = { upsert: true }

  await client.db(dbname).collection('blocks').updateOne(query, update, options)

  const txs = await parseLoopringSubmitBlocksTx(tx)

  txs.forEach(async (tx, idx) => {
    tx._id = dexBlock._id * 1000 + idx
    tx.block = dexBlock._id

    const query = { _id: tx._id }
    const update = { $set: tx }
    const options = { upsert: true }

    await client
      .db(dbname)
      .collection('transactions')
      .updateOne(query, update, options)

    // ------------- update account bindings -------------

    let newAccount = {
      address: zeroAddr,
      _id: undefined,
    }

    if (tx.type === TransactionType[TransactionType.DEPOSIT]) {
      newAccount = {
        address: tx.to,
        _id: tx.toAccountID,
      }
      if (newAccount.address === zeroAddr) {
        console.log(tx)
      }
    } else if (tx.type === TransactionType[TransactionType.TRANSFER]) {
      newAccount = {
        address: tx.to,
        _id: tx.accountToID,
      }
    } else if (tx.type === TransactionType[TransactionType.ACCOUNT_UPDATE]) {
      newAccount = {
        address: tx.owner,
        _id: tx.accountID,
      }

      if (newAccount.address === zeroAddr) {
        console.log(tx)
      }
    }

    if (
      newAccount.address !== zeroAddr &&
      newAccount.address !== null &&
      newAccount._id !== undefined &&
      newAccount._id !== null
    ) {
      await client
        .db(dbname)
        .collection('accounts')
        .updateOne({ _id: newAccount._id }, { $set: newAccount }, options)
    }
  })
}

const main = async () => {
  await client.connect()
  await client
    .db(dbname)
    .createCollection('blocks')
    .catch((error) => {})
  await client
    .db(dbname)
    .createCollection('transactions')
    .catch((error) => {})
  await client
    .db(dbname)
    .createCollection('accounts')
    .catch((error) => {})
  await client
    .db(dbname)
    .createCollection('balances')
    .catch((error) => {})

  // getPastLogs
  const subscription = web3.eth.subscribe(
    'logs',
    {
      fromBlock: startBlock,
      address: exchangeV3,
      topics: [eventBlockSubmitted],
    },
    onEvent
  )
}

main()
console.log('end')
