import { createHash } from "crypto";
import { base64ToBigint, bigintToBuf, hexToBigint } from "bigint-conversion";
import { makePlist } from "./makePlist.js";
import { type BufferFileList } from "../common/fileList.js";

// utility for signing popclip extensions

export type KeyPair = { publicKey: bigint; privateKey: bigint };

export class Signer {
  private keys: KeyPair;

  // Create a new AquaticPrime instance with a public and private key
  constructor({
    publicKey,
    privateKey,
    keyFormat,
  }: {
    publicKey: string;
    privateKey: string;
    keyFormat: "hex" | "base64";
  }) {
    if (keyFormat === "hex") {
      this.keys = {
        publicKey: hexToBigint(publicKey),
        privateKey: hexToBigint(privateKey),
      };
    } else if (keyFormat === "base64") {
      this.keys = {
        publicKey: base64ToBigint(publicKey),
        privateKey: base64ToBigint(privateKey),
      };
    } else {
      throw new Error(`Unknown key format: ${keyFormat}`);
    }
  }

  async extensionSignature(files: BufferFileList, packageName: string) {
    const hash = await calculateDigest(files, packageName);
    const Signature = signHash(hash, this.keys);
    const name = "_Signature.plist";
    const contentsBuffer = Buffer.from(makePlist({ Signature }));
    return { name, contentsBuffer };
  }
}

// Modular exponentiation
const powmod = (base: bigint, exponent: bigint, modulus: bigint): bigint => {
  let e = exponent;
  let b = base;
  let r = 1n; // result
  while (e > 0n) {
    if (e % 2n === 1n) {
      r = (r * b) % modulus;
    }
    e = e >> 1n;
    b = (b * b) % modulus;
  }
  return r;
};

function padHash(hash: Buffer) {
  return BigInt(`0x0001${"ff".repeat(105)}00${hash.toString("hex")}`);
}

function signHash(hash: Buffer, keys: KeyPair) {
  return bigintToBuf(powmod(padHash(hash), keys.privateKey, keys.publicKey));
}

async function calculateDigest(files: BufferFileList, packageName: string) {
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
    const baseName = packageName.split("/").at(-1)!;
    dataList.push(separator);
    dataList.push(Buffer.from(baseName));
    dataList.push(separator);
    dataList.push(file.contentsBuffer);
  }

  // Return the SHA-1 hash of the concatenated data
  return createHash("sha1").update(Buffer.concat(dataList)).digest();
}
