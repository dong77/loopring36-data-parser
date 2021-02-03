import * as BN from 'bn.js'
import { Bitstream } from '../bitstream'
import { Constants } from '../constants'
import { fromFloat } from '../float'

interface Transfer {
  accountFromID?: number
  accountToID?: number
  tokenID?: number
  amount?: string
  feeTokenID?: number
  fee?: string
  validUntil?: number
  storageID?: number
  from?: string
  to?: string
  data?: string
}

/**
 * Processes transfer requests.
 */
export class TransferProcessor {
  public static extractData(data: Bitstream) {
    const transfer: Transfer = {}
    let offset = 1

    // Check that this is a conditional update
    const transferType = data.extractUint8(offset)
    offset += 1

    transfer.accountFromID = data.extractUint32(offset)
    offset += 4
    transfer.accountToID = data.extractUint32(offset)
    offset += 4
    transfer.tokenID = data.extractUint16(offset)
    offset += 2
    transfer.amount = fromFloat(
      data.extractUint24(offset),
      Constants.Float24Encoding
    ).toString()
    offset += 3
    transfer.feeTokenID = data.extractUint16(offset)
    offset += 2
    transfer.fee = fromFloat(
      data.extractUint16(offset),
      Constants.Float16Encoding
    ).toString()
    offset += 2
    transfer.storageID = data.extractUint32(offset)
    offset += 4
    transfer.to = data.extractAddress(offset)
    offset += 20
    transfer.from = data.extractAddress(offset)
    offset += 20

    return transfer
  }
}
