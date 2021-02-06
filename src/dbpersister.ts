const mongo = require('mongodb')

const MongoClient = require('mongodb').MongoClient

async function getPersister(dbUrl, dbName) {
  const url = dbUrl || 'mongodb://localhost:27017/'

  const name = dbName || 'explorer4'

  const client = new MongoClient(url)

  await client.connect()

  const db = client.db(name)
  await db.createCollection('status').catch((err) => {})
  await db.createCollection('blocks').catch((err) => {})
  await db.createCollection('transactions').catch((err) => {})
  await db.createCollection('accounts').catch((err) => {})
  await db.createCollection('balances').catch((err) => {})

  const loadStatus = async (defaultFirstEthBlock) => {
    const status = await db.collection('status').findOne({ _id: 1 })

    console.log('status:', status)

    return (
      status || {
        firstEthBlock: defaultFirstEthBlock,
        lastAccountID: -1,
      }
    )
  }

  const saveStatus = async (status) => {
    await db
      .collection('status')
      .updateOne({ _id: 1 }, { $set: status }, { upsert: true })
  }

  const persist = async (data) => {
    console.log('persisting block', data.block._id, '...')
  }

  return { client, loadStatus, saveStatus, persist }
}

export default getPersister

// const onEvent = async (error, event) => {
//   const block = await web3.eth.getBlock(event.blockNumber)
//   const tx = await web3.eth.getTransaction(event.transactionHash)

//   const dexBlock = { ...event, ...tx }

//   dexBlock._id = parseInt(new BN(dexBlock.topics[1].substring(2)).toString())
//   dexBlock.dexMerkelRoot = dexBlock.data.substring(0, 64 + 2)
//   dexBlock.dexPublicDataHash = '0x' + dexBlock.data.substring(66)
//   dexBlock.timestamp = block.timestamp

//   delete dexBlock.input
//   delete dexBlock.hash
//   delete dexBlock.data
//   delete dexBlock.topics
//   delete dexBlock.id
//   delete dexBlock.nonce
//   delete dexBlock.value
//   delete dexBlock.r
//   delete dexBlock.s
//   delete dexBlock.v
//   delete dexBlock.removed
//   delete dexBlock.logIndex
//   delete dexBlock.transactionIndex
//   delete dexBlock.address
//   delete dexBlock.to
//   delete dexBlock.from

//   const query = { _id: dexBlock._id }
//   const update = { $set: dexBlock }
//   const options = { upsert: true }

//   await client.db(name).collection('blocks').updateOne(query, update, options)

//   const txs = await parseLoopringSubmitBlocksTx(tx)

//   txs.forEach(async (tx, idx) => {
//     tx._id = dexBlock._id * 1000 + idx
//     tx.block = dexBlock._id

//     const query = { _id: tx._id }
//     const update = { $set: tx }
//     const options = { upsert: true }

//     await client
//       .db(name)
//       .collection('transactions')
//       .updateOne(query, update, options)

//     // ------------- update account bindings -------------

//     let newAccount = {
//       address: zeroAddr,
//       _id: undefined,
//     }

//     if (tx.type === TransactionType[TransactionType.DEPOSIT]) {
//       newAccount = {
//         address: tx.to,
//         _id: tx.toAccountID,
//       }
//       if (newAccount.address === zeroAddr) {
//         console.log(tx)
//       }
//     } else if (tx.type === TransactionType[TransactionType.TRANSFER]) {
//       newAccount = {
//         address: tx.to,
//         _id: tx.accountToID,
//       }
//     } else if (tx.type === TransactionType[TransactionType.ACCOUNT_UPDATE]) {
//       newAccount = {
//         address: tx.owner,
//         _id: tx.accountID,
//       }

//       if (newAccount.address === zeroAddr) {
//         console.log(tx)
//       }
//     }

//     if (
//       newAccount.address !== zeroAddr &&
//       newAccount.address !== null &&
//       newAccount._id !== undefined &&
//       newAccount._id !== null
//     ) {
//       await client
//         .db(name)
//         .collection('accounts')
//         .updateOne({ _id: newAccount._id }, { $set: newAccount }, options)
//     }
//   })
// }

// const main = async () => {
//   await client.connect()
//   await client
//     .db(name)
//     .createCollection('blocks')
//     .catch((err)=>{})

//   await client
//     .db(name)
//     .createCollection('transactions')
//     .catch((err)=>{})

//   await client
//     .db(name)
//     .createCollection('accounts')
//     .catch((err)=>{})

//   await client
//     .db(name)
//     .createCollection('balances')
//     .catch((err)=>{})

//   // getPastLogs
//   const subscription = web3.eth.subscribe(
//     'logs',
//     {
//       fromBlock: startBlock,
//       address: exchangeV3,
//       topics: [eventBlockSubmitted],
//     },
//     onEvent
//   )
// }
