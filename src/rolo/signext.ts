import crypto from "crypto";
import { base64ToBigint, bigintToBuf, hexToBigint } from "bigint-conversion";
import { makePlist } from "./makePlist.js";
import { ZExtensionFileListEntry } from "../common/extensionSchemas.js";
import { z } from "zod";
import path from "node:path";

// utility for signing popclip extensions

export const ZDataFileListEntry = ZExtensionFileListEntry.omit({
  hash: true,
  size: true,
}).required();
export type DataFileListEntry = z.infer<typeof ZDataFileListEntry>;

export type KeyPair = { publicKey: bigint; privateKey: bigint };

export class Signer {
  private privateKey: crypto.KeyObject;

  // Create a new AquaticPrime instance with a public and private key
  constructor(privateKeyPem: string) {
    this.privateKey = crypto.createPrivateKey(privateKeyPem);
  }

  extensionSignature(files: DataFileListEntry[], packageName: string) {
    const data = dataToSign(files, packageName);
    const Signature = signData(data, this.privateKey);
    const name = "_Signature.plist";
    const contentsBuffer = Buffer.from(makePlist({ Signature }));
    return { name, contentsBuffer };
  }
}

// zero padding??
function signData(data: Buffer, key: crypto.KeyObject) {
  // import the private key
  const signer = crypto.createSign("RSA-SHA1");
  signer.update(data);
  const sig = signer.sign(key);
  console.log({ sig, b64: sig.toString("base64") });
  return sig;
}

function dataToSign(files: DataFileListEntry[], packageName: string) {
  // Sort array with case-insensitive comparison
  const sortedFiles = files.sort((a, b) =>
    a.path.localeCompare(b.path, "en-US", {
      sensitivity: "accent",
      caseFirst: "upper",
    }),
  );

  // Add each file to the data list
  const separator = Buffer.from("+++");
  const dataList = [Buffer.from(packageName)];
  for (const file of sortedFiles) {
    const baseName = path.basename(file.path);
    dataList.push(separator);
    dataList.push(Buffer.from(baseName));
    dataList.push(separator);
    dataList.push(file.data);
  }
  return Buffer.concat(dataList);

  // Return the SHA-1 hash of the concatenated data
  // return crypto.createHash("sha1").update(Buffer.concat(dataList)).digest();
}
