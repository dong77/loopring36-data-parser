const Web3 = require('web3')
import { Mutex } from 'async-mutex'
import { TransactionType } from './types'
import { writeTxtFile, writeJsonFile } from './filepersister'
import getPersister from './dbpersister'
import { zeroAddr, extractBlock, extractToken } from './extractor'

const geth = 'wss://mainnet.infura.io/ws/v3/3cdee1310ccc4e9fbb19bf8d9967358e'

// const exchangeOwner = '0x42bc1ab51b7af89cfaa88a7291ce55971d8cb83a'
const exchangeV3 = '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4'

const eventTokenRegistered =
  '0x678eb1f52e3e76c52c1143d5699af1d8a5e03743e8840223ccb27aabf3c44c0a'
const eventBlockSubmitted =
  '0xcc86d9ed29ebae540f9d25a4976d4da36ea4161b854b8ecf18f491cf6b0feb5c'

let web3 = new Web3(
  new Web3.providers.WebsocketProvider(geth, {
    clientConfig: {
      maxReceivedFrameSize: 10000000000,
      maxReceivedMessageSize: 10000000000,
    },
  })
)
const main = async () => {
  const deployBlockNumber = 11149814
  // const persister = await getPersister('mongodb://localhost:27017/', 'A9')

  // const status = await persister.loadStatus(deployBlockNumber)
  // console.log(status)
  const status = { nextEthBlock: deployBlockNumber }

  const mutex = new Mutex()

  const processEvent = async (err, event) => {
    if (err) {
      console.error(err)
      return
    }

    await mutex.runExclusive(async () => {
      // console.log('------------', event)

      if (event.topics[0] === eventBlockSubmitted) {
        const data = await extractBlock(web3, event)

        await writeJsonFile('./data/blocks/', 'block_' + data.block._id, data)
        // await persister.persistBlock(data)
        console.log(
          'block:',
          data.block._id,
          'operator:',
          data.block.from,
          'height:',
          data.block.blockNumber,
          'cached:',
          data.cached
        )
      } else {
        const token = await extractToken(web3, event)
        if (token !== {}) {
          await writeJsonFile('./data/tokens/', 'token_' + token._id, token)
          const cached = token.cached || false
          delete token.cached
          // await persister.persistToken(token)
          console.log(
            'token:',
            token.address,
            'id:',
            token._id,
            'height:',
            token.blockNumber,
            'cached:',
            cached
          )
        }
      }

      status.nextEthBlock = event.blockNumber + 1
      // await persister.saveStatus(status)
    })
  }

  // order is important, we want to process token registration first.
  const events = [
    // eventTokenRegistered,

    eventBlockSubmitted,
  ]

  events.forEach((evt) => {
    const subscription1 = web3.eth.subscribe(
      'logs',
      {
        fromBlock: status.nextEthBlock,
        address: exchangeV3,
        topics: [evt],
      },
      processEvent
    )
  })
}

main()
