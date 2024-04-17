import test from "ava";
import { Signer } from "../../src/rolo/signext.js";

const testKeyPair = {
  publicKey:
    "0e2f7ca435987cd64101b5e18c18e353a0449d2730127086a2e08a358a4f244e8c0094387e3a1a13e6a399c582f55649166b339ed0a80fe5aa5ab1e69b649646bbbad9e0d9c2f8bca33ffb9cc5543fe17f69bfd9939a583828261dcca7ee71c508c3d2921c3e406ba704ab88bacc4de35859b1d47d92030e83c183bc5bc93a60",
  privateKey:
    "9efcba42a65aa2676b91cc868b90b867c64d4e29fc2193272cfab48f5ce340b8157a750dbe3f7209e9e7a3a9118ce9a66274127aa2da4303e0df950c096e0785c4d2ef1e71831f6f1f753bf5d876985f9e708f6ce669b2fcb8b4ec9e67b033d255d1f00e6874d4a4ded45c1d198f2f97fc410c2064042e979361c205e5222bd9",
  keyFormat: "hex" as const,
};

const testData = {
  fileList: [
    {
      path: "x.txt",
      buffer: Buffer.from(`xxx`),
      exec: false,
    },
  ],
  packageName: "x.popclipext",
};

test("Signer extensionSignature", async (t) => {
  const signer = new Signer(testKeyPair);
  const { name, contentsBuffer } = await signer.extensionSignature(
    testData.fileList,
    testData.packageName,
  );
  t.is(name, "_Signature.plist");
  // extract sig from plist
  const plist = contentsBuffer.toString();
  const sig = plist.match(/<data>(.*)<\/data>/)?.[1]!;
  // verify sig
  const sigBuffer = Buffer.from(sig, "base64");
  t.is(sigBuffer.length, 128);
});
