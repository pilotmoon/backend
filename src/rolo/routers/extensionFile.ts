import { log } from "../../common/log.js";
import { AuthKind } from "../auth.js";
import { ExtensionRecord } from "../controllers/extensionsProcessor.js";
import { kebabCase } from "case-anything";
import { extractDefaultString } from "./extensionView.js";
import { ApiError } from "../../common/errors.js";
import AdmZip from "adm-zip";
import { PortableKeyPair, ZPortableKeyPair } from "../keyPair.js";
import { getRegistryObjectInternal } from "../controllers/registriesController.js";
import { DataFileListEntry, Signer } from "../signext.js";
import { z } from "zod";

let _excludeRegex: RegExp;
export function filesExcludeRegex() {
  if (!_excludeRegex) {
    // exclude certain file names in root
    const excludeFileNames = ["readme.md", "demo.gif", "demo.mp4"];
    const regexParts = excludeFileNames.map((name) => `^([^/]+-)?${name}$`);

    // ... and any path with a segment starting with underscore or dot
    regexParts.push("^([^/]+[/])*[_.]");

    _excludeRegex = new RegExp(
      regexParts.map((part) => `(${part})`).join("|"),
      "i",
    );
  }
  return _excludeRegex;
}

export async function generateExtensionFile(
  ext: ExtensionRecord,
  authKind: AuthKind,
) {
  log("Generating package file", { ext });
  if (!ext.published) {
    throw new ApiError(404, "Extension is not published");
  }

  let packageName = `@${ext.shortcode}.${ext.info.identifier}.popclipext`;
  let zip = new AdmZip();
  //zip.addFile(`${packageName}/test.txt`, Buffer.from("todo"));
  for (let file of ext.files) {
    // note, files list has been pre-filtered in the aggregation
    zip.addFile(
      `${packageName}/${file.path}`,
      file.data!,
      undefined,
      file.executable ? 0o755 : 0o644,
    );
  }
  let key = await getExtensionSigningKey("com.pilotmoon.popclip", authKind);
  let signer = new Signer(key);
  let signature = signer.extensionSignature(
    ext.files.map((file) => ({
      path: file.path,
      data: file.data!,
      executable: !!file.executable,
    })),
    packageName,
  );
  zip.addFile(`${packageName}/${signature.name}`, signature.contentsBuffer);

  let name = `${
    kebabCase(extractDefaultString(ext.info.name)) ?? "extension"
  }-${ext.version}-${ext.shortcode}.popclipextz`;
  return { data: zip.toBuffer(), name };
}

async function getExtensionSigningKey(
  product: string,
  authKind: AuthKind,
): Promise<string> {
  const keys = await getRegistryObjectInternal(
    product,
    "extensionSigningKey",
    authKind,
  );
  if (!keys) {
    throw new Error(`No extension signing key found for product ${product}`);
  }
  return z
    .object({
      object: z.literal("record"),
      record: z.object({ privateKey: z.string() }),
    })
    .parse(keys).record.privateKey;
}
