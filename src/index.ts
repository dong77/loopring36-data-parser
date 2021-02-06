const Web3 = require('web3')
import { TransactionType } from './types'
import writeJsonFile from './filepersister'
import getPersister from './dbpersister'
import { zeroAddr, extractBlock } from './extractor'

const geth = 'wss://mainnet.infura.io/ws/v3/3cdee1310ccc4e9fbb19bf8d9967358e'

const exchangeOwner = '0x42bc1ab51b7af89cfaa88a7291ce55971d8cb83a'
const exchangeV3 = '0x0BABA1Ad5bE3a5C0a66E7ac838a129Bf948f1eA4'

const eventBlockSubmitted =
  '0xcc86d9ed29ebae540f9d25a4976d4da36ea4161b854b8ecf18f491cf6b0feb5c'

let web3 = new Web3(Web3.givenProvider || geth)

const main = async () => {
  const persister = await getPersister(
    'mongodb://localhost:27017/',
    'explorer4'
  )

  const status = await persister.loadStatus(11799600)
  console.log(status)

  const step = 100

  let i = 0
  while (i === 0) {
    web3.eth
      .getPastLogs({
        fromBlock: status.nextEthBlock,
        toBlock: status.nextEthBlock + step,
        address: exchangeV3,
        topics: [eventBlockSubmitted],
      })
      .then(async (events) => {
        i++
        console.log(events.length(), '---------')
        events.forEach(async (event) => {
          const data = await extractBlock(web3, event)
          await writeJsonFile('./blocks/', data.block._id, data)
        })

        status.nextEthBlock += step
        await persister.saveStatus(status)
      })
  }

  // status.nextEthBlock += 1
  // await persister.saveStatus(status)

  // const subscription = web3.eth.subscribe(
  //   'logs',
  //   {
  //     fromBlock: startBlock,
  //     address: exchangeV3,
  //     topics: [eventBlockSubmitted],
  //   },
  //   async (error, event) => {
  //     const data = await extractBlock(web3, event)
  //     await writeJsonFile('./blocks/', data.block._id, data)
  //     await perister.persist(data)
  //   }
  // )
}

main()
