import * as BN from "bn.js";
import { Bitstream } from "../bitstream";
import { Constants } from "../constants";

interface AmmUpdate {
  owner?: string;
  accountID?: number;
  tokenID?: number;
  feeBips?: number;
  tokenWeight?: string
  nonce?: number;
  balance?: string
}

/**
 * Processes amm update requests.
 */
export class AmmUpdateProcessor {
  public static extractData(data: Bitstream) {
    const update: AmmUpdate = {};
    let offset = 1;

    // Read in the AMM update data
    update.owner = data.extractAddress(offset);
    offset += 20;
    update.accountID = data.extractUint32(offset);
    offset += 4;
    update.tokenID = data.extractUint16(offset);
    offset += 2;
    update.feeBips = data.extractUint8(offset);
    offset += 1;
    update.tokenWeight = data.extractUint96(offset).toString();
    offset += 12;
    update.nonce = data.extractUint32(offset);
    offset += 4;
    update.balance = data.extractUint96(offset).toString();
    offset += 12;

    return update;
  }
}
