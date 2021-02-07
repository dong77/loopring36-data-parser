import { TransactionType } from './types'
import { Bitstream } from './bitstream'
import { parseLoopringSubmitBlocksTx } from './parse'
import * as ERC20ABI from './abi/ERC20.abi.json'
import { writeTxtFile, writeJsonFile } from './filepersister'

const fs = require('fs')

const zeroAddr = '0x0000000000000000000000000000000000000000'

const feeSettings = {
  DEPOSIT: 782,
  WITHDRAWAL: 58782,
  TRANSFER: 1582,
  ACCOUNT_UPDATE: 1582,
  SPOT_TRADE: 1582,
  NOOP: 1,
  SIGNATURE_VERIFICATION: 1,
  AMM_UPDATE: 53290 / 2,
}
const extractBlock = async (web3, event) => {
  const BN = web3.utils.BN
  const _id = parseInt(new BN(event.topics[1].substring(2), 16).toString())

  let cached = false
  let dexBlock
  let tx
  let receipt
  try {
    const rawBlock = JSON.parse(
      fs.readFileSync('./data/rawblocks/block_' + _id + '.json')
    )

    tx = rawBlock.tx
    receipt = rawBlock.receipt
    dexBlock = { _id, ...rawBlock.event, ...rawBlock.tx, ...receipt }
    cached = true
  } catch (err) {
    const block = await web3.eth.getBlock(event.blockNumber)
    tx = await web3.eth.getTransaction(event.transactionHash)
    receipt = await web3.eth.getTransactionReceipt(event.transactionHash)

    dexBlock = { _id, ...event, ...tx, ...receipt }

    if (!fs.existsSync('./data/rawblocks/')) {
      fs.mkdirSync('./data/rawblocks/')
    }

    await writeJsonFile('./data/rawblocks/', 'block_' + _id, {
      event,
      tx,
      receipt,
      _id,
    })
  }

  delete dexBlock.input
  delete dexBlock.hash
  delete dexBlock.data
  delete dexBlock.logsBloom
  delete dexBlock.topics
  delete dexBlock.id
  delete dexBlock.nonce
  delete dexBlock.gas
  delete dexBlock.value
  delete dexBlock.r
  delete dexBlock.s
  delete dexBlock.v
  delete dexBlock.removed
  delete dexBlock.logIndex
  delete dexBlock.transactionIndex
  delete dexBlock.address
  delete dexBlock.to

  const transactions = []
  const accounts = {}
  const balances = {}

  function addToAccount(accountID, address) {
    if (accountID !== undefined && address && address !== zeroAddr) {
      accounts[accountID] = address
    }
  }

  function addBalance(accountID, tokenID, amount) {
    if (amount != '0') {
      const balance = balances[accountID] || {}
      const update = balance[tokenID] || { diff: new BN(0), add: true }
      const amountBN = new BN(amount)

      if (update.add === true) {
        update.diff = update.diff.add(amountBN)
      } else if (update.diff.gt(amountBN)) {
        update.diff = update.diff.sub(amountBN)
      } else {
        update.diff = amountBN.sub(update.diff)
        update.add = !update.add
      }

      balance[tokenID] = update
      balances[accountID] = balance
    }
  }

  function removeBalance(accountID, tokenID, amount) {
    if (amount != '0') {
      const balance = balances[accountID] || {}
      const update = balance[tokenID] || { diff: new BN(0), add: true }
      const amountBN = new BN(amount)

      if (update.add === false) {
        update.diff = update.diff.add(amountBN)
      } else if (update.diff.gt(amountBN)) {
        update.diff = update.diff.sub(amountBN)
      } else {
        update.diff = amountBN.sub(update.diff)
        update.add = !update.add
      }

      balance[tokenID] = update
      balances[accountID] = balance
    }
  }

  const txs = await parseLoopringSubmitBlocksTx(tx)

  txs.forEach((tx, idx) => {
    tx._id = dexBlock._id * 10000 + idx
    tx.block = dexBlock._id

    transactions.push(tx)

    if (tx.type === TransactionType[TransactionType.DEPOSIT]) {
      addToAccount(tx.toAccountID, tx.to)
      addBalance(tx.toAccountID, tx.tokenID, tx.amount)
      delete tx.to
    } else if (tx.type === TransactionType[TransactionType.WITHDRAWAL]) {
      removeBalance(tx.fromAccountID, tx.tokenID, tx.amount)
      removeBalance(tx.fromAccountID, tx.feeTokenID, tx.fee)

      addBalance(0, tx.feeTokenID, tx.fee)

      delete tx.from
      // TODO tx.to address not found.
    } else if (tx.type === TransactionType[TransactionType.TRANSFER]) {
      addToAccount(tx.accountToID, tx.to)

      removeBalance(tx.accountFromID, tx.tokenID, tx.amount)
      removeBalance(tx.accountFromID, tx.feeTokenID, tx.fee)

      addBalance(tx.accountToID, tx.tokenID, tx.amount)
      addBalance(0, tx.feeTokenID, tx.fee)

      delete tx.from
      delete tx.to
    } else if (tx.type === TransactionType[TransactionType.ACCOUNT_UPDATE]) {
      addToAccount(tx.accountID, tx.owner)

      removeBalance(tx.accountID, tx.feeTokenID, tx.fee)
      addBalance(0, tx.feeTokenID, tx.fee)

      delete tx.owner
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

  const accounts_ = []

  Object.keys(accounts).map((accountID) => {
    accounts_.push({
      accountID: parseInt(accountID),
      address: accounts[accountID],
    })
  })

  const balances_ = []

  Object.keys(balances).map((accountID) => {
    const balance = balances[accountID]
    Object.keys(balance).map((tokenID) => {
      const diff = balance[tokenID].diff.toString()
      const add = balance[tokenID].add
      balances_.push({
        _id: parseInt(accountID),
        tokenID: parseInt(tokenID),
        diff,
        add,
      })
    })
  })

  const data = {
    block: dexBlock,
    accounts: accounts_,
    balances: balances_,
    transactions,
    cached: cached,
  }
  // console.log(data.accounts)
  return data
}

const extractToken = async (web3, event) => {
  const bs = new Bitstream(event.data)
  const address = bs.extractAddress(12)
  const _id = parseInt(bs.extractUint(32).toString())

  let token
  try {
    token = JSON.parse(
      fs.readFileSync('./data/rawtokens/token_' + _id + '.json')
    )
    token.cached = true
  } catch (err) {
    if (_id === 24) {
      //disabled
      token = {}
    } else {
      const block = await web3.eth.getBlock(event.blockNumber)
      if (_id === 7) {
        token = {
          _id,
          address,
          name: 'Maker',
          symbol: 'MKR',
          decimals: 18,
          blockNumber: event.blockNumber,
          timestamp: block.timestamp,
        }
      } else if (address === zeroAddr) {
        token = {
          _id,
          address,
          name: 'Ether',
          symbol: 'ETH',
          decimals: 18,
          blockNumber: event.blockNumber,
          timestamp: block.timestamp,
        }
      } else {
        const contract = new web3.eth.Contract(ERC20ABI, address)
        const name = await contract.methods.name().call()
        const symbol = await contract.methods.symbol().call()
        const decimals = parseInt(await contract.methods.decimals().call())
        token = {
          _id,
          address,
          name,
          symbol,
          decimals,
          blockNumber: event.blockNumber,
          timestamp: block.timestamp,
        }
      }
    }

    if (!fs.existsSync('./data/rawtokens/')) {
      fs.mkdirSync('./data/rawtokens/')
    }

    await writeJsonFile('./data/rawtokens/', 'token_' + _id, token)
  }

  return token
}
export { zeroAddr, extractBlock, extractToken }
