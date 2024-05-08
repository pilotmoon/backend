import crypto from "crypto";
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
    const Signature = signData(dataToSign(files, packageName), this.privateKey);
    const contentsBuffer = Buffer.from(makePlist({ Signature }));
    return { name: "_Signature.plist", contentsBuffer };
  }
}

function signData(data: Buffer, key: crypto.KeyObject) {
  return crypto.createSign("RSA-SHA1").update(data).sign(key);
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
}
