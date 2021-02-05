const Web3 = require('web3')
import { TransactionType } from './types'
const mongo = require('mongodb')

const awsGeth =
  'ws://ec2-13-250-42-164.ap-southeast-1.compute.amazonaws.com:8545'
const infura = 'wss://mainnet.infura.io/ws/v3/3cdee1310ccc4e9fbb19bf8d9967358e'

const startBlock = 11763791
const exchangeOwner = '0x42bc1ab51b7af89cfaa88a7291ce55971d8cb83a'
const exchangeV3 = '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4'

const eventBlockSubmitted =
  '0xcc86d9ed29ebae540f9d25a4976d4da36ea4161b854b8ecf18f491cf6b0feb5c'

let web3 = new Web3(Web3.givenProvider || infura)
const BN = web3.utils.BN

const { parseLoopringSubmitBlocksTx } = require('./parse.ts')

const zeroAddr = '0x0000000000000000000000000000000000000000'

const processNewBlock = async (error, event) => {
  const block = await web3.eth.getBlock(event.blockNumber)
  const tx = await web3.eth.getTransaction(event.transactionHash)

  const dexBlock = { ...event, ...tx }

  dexBlock._id = parseInt(new BN(dexBlock.topics[1].substring(2)).toString())
  dexBlock.dexMerkelRoot = dexBlock.data.substring(0, 64 + 2)
  dexBlock.dexPublicDataHash = '0x' + dexBlock.data.substring(66)
  dexBlock.timestamp = block.timestamp

  console.log('processing block ', dexBlock._id, '...')

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

  const transactions = []
  const accounts = {}
  const balances = {}

  function addToAccount(accountID, address) {
    if (accountID !== undefined && address && address !== zeroAddr) {
      accounts[accountID] = address
      // console.log(accountID, ' => ', address);
    }
  }

  function addBalance(accountID, tokenID, amount) {
    if (amount != '0') {
      const balance = balances[accountID] || {}
      const updates = balance[tokenID] || []
      updates.push({ amount: amount, add: true })
      balance[tokenID] = updates
      balances[accountID] = balance
    }
  }

  function removeBalance(accountID, tokenID, amount) {
    if (amount != '0') {
      const balance = balances[accountID] || {}
      const updates = balance[tokenID] || []
      updates.push({ amount: amount, add: false })
      balance[tokenID] = updates
      balances[accountID] = balance
    }
  }

  const txs = await parseLoopringSubmitBlocksTx(tx)

  txs.forEach(async (tx, idx) => {
    tx._id = dexBlock._id * 1000 + idx
    tx.block = dexBlock._id

    transactions.push(tx)

    if (tx.type === TransactionType[TransactionType.DEPOSIT]) {
      addToAccount(tx.toAccountID, tx.to)
      addBalance(tx.toAccountID, tx.tokenID, tx.amount)
    }
    if (tx.type === TransactionType[TransactionType.WITHDRAWAL]) {
      removeBalance(tx.fromAccountID, tx.tokenID, tx.amount)
      removeBalance(tx.fromAccountID, tx.feeTokenID, tx.fee)

      addBalance(0, tx.feeTokenID, tx.fee)
    } else if (tx.type === TransactionType[TransactionType.TRANSFER]) {
      addToAccount(tx.accountToID, tx.to)

      removeBalance(tx.accountFromID, tx.tokenID, tx.amount)
      removeBalance(tx.accountFromID, tx.feeTokenID, tx.fee)

      addBalance(tx.accountToID, tx.tokenID, tx.amount)
      addBalance(0, tx.feeTokenID, tx.fee)
    } else if (tx.type === TransactionType[TransactionType.ACCOUNT_UPDATE]) {
      addToAccount(tx.accountID, tx.owner)

      removeBalance(tx.accountID, tx.feeTokenID, tx.fee)
      addBalance(0, tx.feeTokenID, tx.fee)
    } else if (tx.type === TransactionType[TransactionType.SPOT_TRADE]) {
      removeBalance(tx.accountIdA, tx.tokenA, tx.fillSA)
      addBalance(tx.accountIdB, tx.tokenA, tx.fillSA)

      removeBalance(tx.accountIdA, tx.tokenA, tx.feeA)
      addBalance(0, tx.tokenA, tx.feeA)

      removeBalance(tx.accountIdB, tx.tokenB, tx.fillSB)
      addBalance(tx.accountIdA, tx.tokenB, tx.fillSB)

      removeBalance(tx.accountIdB, tx.tokenB, tx.feeB)
      addBalance(0, tx.tokenB, tx.feeB)
    } else if (
      tx.type === TransactionType[TransactionType.NOOP] ||
      tx.type === TransactionType[TransactionType.SIGNATURE_VERIFICATION] ||
      tx.type === TransactionType[TransactionType.AMM_UPDATE]
    ) {
    } else {
      console.log(tx)
    }
  })

  const data = { dexBlock, accounts, transactions }
  // console.log(data.accounts)
  return data
}

const main = async () => {
  const subscription = web3.eth.subscribe(
    'logs',
    {
      fromBlock: startBlock,
      address: exchangeV3,
      topics: [eventBlockSubmitted],
    },
    processNewBlock
  )
}

main()
