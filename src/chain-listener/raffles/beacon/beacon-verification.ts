import * as bls from "@noble/bls12-381";
import { ChainedBeacon, ChainInfo, isChainedBeacon, RandomnessBeacon } from "./index";

async function verifyBeacon(chainInfo: ChainInfo, beacon: RandomnessBeacon): Promise<boolean> {
  const publicKey = chainInfo.public_key;

  if (isChainedBeacon(beacon, chainInfo)) {
    return bls.verify(beacon.signature, await chainedBeaconMessage(beacon), publicKey);
  }

  console.error(
    `Beacon type ${chainInfo.schemeID} was not supported or the fields of the provided beacon did not match the requirements`,
  );
  return false;
}

async function chainedBeaconMessage(beacon: ChainedBeacon): Promise<Uint8Array> {
  return await bls.utils.sha256(
    Buffer.concat([signatureBuffer(beacon.previous_signature), roundBuffer(beacon.round)]),
  );
}

function signatureBuffer(sig: string) {
  return Buffer.from(sig, "hex");
}

function roundBuffer(round: number) {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(round));
  return buffer;
}

export { verifyBeacon, roundBuffer };
