import AdmZip from "adm-zip";
import { kebabCase } from "case-anything";
import { z } from "zod";
import { ApiError } from "../../common/errors.js";
import { log } from "../../common/log.js";
import { AuthKind } from "../auth.js";
import { ExtensionRecord } from "../controllers/extensionsProcessor.js";
import { getRegistryObjectInternal } from "../controllers/registriesController.js";
import { extractDefaultString } from "./extensionView.js";
import { Signer } from "../signext.js";

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

  // flesh out file data
  let files = ext.files.map((file) => ({
    ...file,
    data: file.data!,
    executable: !!file.executable,
  }));

  // add files to zip
  let packageName = `@${ext.shortcode}.${ext.info.identifier}.popclipext`;
  let zip = new AdmZip();
  for (let file of files) {
    // note, files list has been pre-filtered in the aggregation
    zip.addFile(
      `${packageName}/${file.path}`,
      file.data,
      undefined,
      file.executable ? 0o755 : 0o644,
    );
  }

  // add signature file
  let { key_v1, key_v2 } = await getExtensionSigningKeys(authKind);
  let signature = await new Signer(key_v1, key_v2).extensionSignature(
    files,
    packageName,
    {
      identifier: ext.info.identifier,
      shortcode: ext.shortcode,
      version: ext.version,
    },
  );
  zip.addFile(`${packageName}/${signature.name}`, signature.contentsBuffer);

  // return zip buffer
  let name = `${
    kebabCase(extractDefaultString(ext.info.name)) ?? "extension"
  }-${ext.version}-${ext.shortcode}.popclipextz`;
  return { data: zip.toBuffer(), name };
}

const keyMap = new Map<AuthKind, { key_v1: string; key_v2: string }>();
async function getExtensionSigningKeys(authKind: AuthKind) {
  let keys = keyMap.get(authKind);
  if (keys) return keys;

  const keysRecord = await getRegistryObjectInternal(
    "com.pilotmoon.popclip",
    "extensionSigningKeys",
    authKind,
  );
  if (!keysRecord) {
    throw new Error(`No popclipext signing key found for kind ${authKind}`);
  }

  let keyRecord = z
    .object({
      object: z.literal("record"),
      record: z.object({
        privateKey_v1: z.string(),
        privateKey_v2: z.string(),
      }),
    })
    .parse(keysRecord);

  log("Loaded extension signing key", { authKind });
  keys = {
    key_v1: keyRecord.record.privateKey_v1,
    key_v2: keyRecord.record.privateKey_v2,
  };
  keyMap.set(authKind, keys);
  return keys;
}
