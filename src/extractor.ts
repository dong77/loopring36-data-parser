import { TransactionType } from './types'

import { parseLoopringSubmitBlocksTx } from './parse'

const zeroAddr = '0x0000000000000000000000000000000000000000'

const extractBlock = async (web3, event) => {
  const BN = web3.utils.BN
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
    tx._id = dexBlock._id * 1000 + idx
    tx.block = dexBlock._id

    transactions.push(tx)

    if (tx.type === TransactionType[TransactionType.DEPOSIT]) {
      addToAccount(tx.toAccountID, tx.to)
      addBalance(tx.toAccountID, tx.tokenID, tx.amount)
    } else if (tx.type === TransactionType[TransactionType.WITHDRAWAL]) {
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
        accountID: parseInt(accountID),
        tokenID: parseInt(tokenID),
        diff,
        add,
      })
    })
  })
  console.log('block ', dexBlock._id, 'processed')
  const data = {
    block: dexBlock,
    accounts: accounts_,
    balances: balances_,
    transactions,
  }
  // console.log(data.accounts)
  return data
}

export { zeroAddr, extractBlock }
