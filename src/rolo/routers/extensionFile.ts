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
  let key = await getExtensionSigningKey(authKind);
  let signature = new Signer(key).extensionSignature(
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

const keyMap = new Map<AuthKind, string>();
async function getExtensionSigningKey(authKind: AuthKind) {
  let key = keyMap.get(authKind);
  if (key) return key;

  const keysRecord = await getRegistryObjectInternal(
    "com.pilotmoon.popclip",
    "extensionSigningKey",
    authKind,
  );
  if (!keysRecord) {
    throw new Error(`No popclipext signing key found for kind ${authKind}`);
  }

  key = z
    .object({
      object: z.literal("record"),
      record: z.object({ privateKey: z.string() }),
    })
    .parse(keysRecord).record.privateKey;

  keyMap.set(authKind, key);
  return key;
}
