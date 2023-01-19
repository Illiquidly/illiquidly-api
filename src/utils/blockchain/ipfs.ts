import axios from "axios";
import { omit } from "lodash";
import { CW721TokenMetadata } from "src/utils-api/entities/nft-info.entity";
import { asyncAction } from "../js/asyncAction";

const fallbackIPFSUrls = [
  "https://d1mx8bduarpf8s.cloudfront.net/",
  "https://ipfs.fleek.co/ipfs/",
  "https://ipfs.io/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
];

export function fromIPFSImageURLtoImageURL(originUrl?: string): string[] {
  return fallbackIPFSUrls.map(ipfsUrl => encodeURI((originUrl || "").replace("ipfs://", ipfsUrl)));
}

export async function mapImageURL(metadata: CW721TokenMetadata) {
  // 1. If metadata are associated with a talis query, we query the metadata from the link provided
  let talisMeta;
  if ((metadata.tokenUri ?? "").includes("talis")) {
    const [error, response] = await asyncAction(axios.get(metadata.tokenUri));
    if (error) {
      talisMeta = undefined;
    }
    if (response) {
      talisMeta = {
        ...response.data,
        attributes: Object.entries(omit(response.data, ["description", "media", "title"])).map(
          ([key, value]) => ({
            displayType: null,
            traitType: key,
            value,
          })
        ),
      };
    }
  }  
  
  return talisMeta
      ? [talisMeta?.media ?? ""]
      : fromIPFSImageURLtoImageURL(metadata.image ?? "");
}
