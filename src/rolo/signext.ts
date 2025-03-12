import * as ed from "@noble/ed25519";
import crypto from "node:crypto";
import path from "node:path";
import { log } from "../common/log.js";
import { makePlist } from "./makePlist.js";

/*
Utility for signing PopCLip extension packages
*/

// polyfill needed for @noble/ed25519
import { webcrypto } from "node:crypto";
// @ts-ignore
if (!globalThis.crypto) globalThis.crypto = webcrypto;

export type DataFileListEntry = {
  path: string;
  data: Buffer;
  executable: boolean;
};

export class Signer {
  private privateKey_v1: crypto.KeyObject; // PEM RSA
  private privateKey_v2: Buffer; // ed25519

  // create a new signer with private keys
  constructor(privateKey_v1: string, privateKey_v2: string) {
    this.privateKey_v1 = crypto.createPrivateKey(privateKey_v1.trim());
    this.privateKey_v2 = Buffer.from(privateKey_v2, "base64");
  }

  async extensionSignature(
    files: DataFileListEntry[],
    packageName: string,
    meta: Record<string, string>,
  ) {
    log("signing", { packageName, meta });
    const Signature = signData_v1(
      dataToSign(files, { mode: "v1", packageName }),
      this.privateKey_v1,
    );
    const SignatureV2 = await signData_v2(
      dataToSign(files, { mode: "v2", meta }),
      this.privateKey_v2,
    );
    const contentsBuffer = Buffer.from(
      makePlist({ Signature, SignatureV2, Metadata: meta }),
    );
    return { name: "_Signature.plist", contentsBuffer };
  }
}

function signData_v1(data: Buffer, key: crypto.KeyObject) {
  return crypto.createSign("RSA-SHA1").update(data).sign(key);
}

async function signData_v2(data: Buffer, key: Buffer) {
  return Buffer.from(await ed.signAsync(data, key));
}

export type DigestOptions =
  | {
      mode: "v1";
      packageName: string;
    }
  | {
      mode: "v2";
      meta: Record<string, string>;
    };

// V1 has some deficiences in the signature format.
// - Only the file's basename is included in the signature, so if it's in a
// subdirectory, the path can be changed without invalidating the signature.
// - The signature does not account for the file's executable bit.
// V2 fixes these issues by including the full path and the executable bit.
// V1 encodes the package name in the signature, while V2 does not.
// V2 add metadata to the signature.
function dataToSign(files: DataFileListEntry[], opts: DigestOptions) {
  const dataList: Buffer[] = [];
  function pushRecord(str: string) {
    dataList.push(Buffer.from(`${str}\x1E`));
  }
  sortFiles(files);
  if (opts.mode === "v1") {
    dataList.push(Buffer.from(opts.packageName));
    for (const file of files) {
      dataList.push(Buffer.from(`+++${path.basename(file.path)}+++`));
      dataList.push(file.data);
    }
  } else if (opts.mode === "v2") {
    pushRecord(`popclipext ${files.length}`);
    for (const [key, value] of sortedKeys(opts.meta)) {
      pushRecord(`${key} ${value}`);
    }
    pushRecord("");
    for (const file of files) {
      const hash = crypto.createHash("sha256").update(file.data).digest("hex");
      const exe = file.executable ? "1" : "0";
      pushRecord(`${hash} ${exe} ${file.data.length} ${file.path}`);
    }
  }
  return Buffer.concat(dataList);
}

// Sort array with case-insensitive comparison as required by PopClip
function sortFiles(files: DataFileListEntry[]) {
  files.sort((a, b) =>
    a.path.localeCompare(b.path, "en-US", {
      sensitivity: "accent",
      caseFirst: "upper",
    }),
  );
}

// Sort objects by key, into array of [k, v]
function sortedKeys(meta: Record<string, string>) {
  return Object.entries(meta).sort(([keyA], [keyB]) =>
    keyA.localeCompare(keyB, "en-US"),
  );
}
