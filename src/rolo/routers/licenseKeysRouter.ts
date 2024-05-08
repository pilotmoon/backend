import { randomUUID } from "node:crypto";
import { create as createCDH } from "content-disposition-header";
import _ from "lodash";
import { ApiError } from "../../common/errors.js";
import { log } from "../../common/log.js";
import {
  LicenseKeyRecord,
  ZLicenseKeyInfo,
  ZLicenseKeyRecord,
  ZLicenseKeyUpdate,
  createLicenseKey,
  generateLicenseFile,
  getProductConfig,
  listLicenseKeys,
  readLicenseKey,
  updateLicenseKey,
} from "../controllers/licenseKeysController.js";
import { makeIdentifierPattern } from "../identifiers.js";
import { AppContext, makeRouter } from "../koaWrapper.js";
import { setBodySpecialFormat } from "../makeFormats.js";
import { generateResourceToken } from "../resourceToken.js";

export const router = makeRouter({ prefix: "/licenseKeys" });
const matchId = {
  pattern: makeIdentifierPattern("id", "lk"),
  uuid: randomUUID(),
};
const matchFile = {
  pattern: `${matchId.pattern}/file`,
  uuid: randomUUID(),
};

// return full response body including license file and download URL
async function expand(document: LicenseKeyRecord, ctx: AppContext) {
  const license = await generateLicenseFile(document, ctx.state.auth.kind);
  const token = generateResourceToken(
    "licenseKeys",
    document._id,
    ctx.state.auth.kind,
  );
  const url = ctx.getLocation(matchFile.uuid, { id: document._id }, { token });
  return {
    ..._.omit(document, "emailHash"),
    file: { ..._.omit(license, "plist"), url },
  };
}

// Create a new license key
router.post("/", async (ctx) => {
  const data = ZLicenseKeyInfo.strict().parse(ctx.request.body);

  // check that the product id is valid
  try {
    const config = await getProductConfig(data.product, ctx.state.auth.kind);
    log(`Creating license key for ${config.productName}`);
  } catch (err) {
    throw new ApiError(400, `Invalid product '${data.product}'`);
  }

  const document = await createLicenseKey(data, ctx.state.auth);
  ctx.body = await expand(document, ctx);
  ctx.status = 201;
  ctx.set("Location", ctx.getLocation(matchId.uuid, { id: document._id }));
});

// list license keys
router.get("/", async (ctx) => {
  const documents = await listLicenseKeys(
    ctx.query,
    ctx.state.pagination,
    ctx.state.auth,
  );
  if (!setBodySpecialFormat(ctx, documents)) {
    ctx.body = await Promise.all(
      documents.map((document) => {
        const parsed = ZLicenseKeyRecord.safeParse(document);
        return parsed.success ? expand(parsed.data, ctx) : document;
      }),
    );
  }
});

// Get a license key by id
router.get(matchId.uuid, matchId.pattern, async (ctx) => {
  const document = await readLicenseKey(ctx.params.id, ctx.state.auth);
  if (document) {
    ctx.body = await expand(document, ctx);
  }
});

// Get a license key file by id
router.get(matchFile.uuid, matchFile.pattern, async (ctx) => {
  const document = await readLicenseKey(ctx.params.id, ctx.state.auth);
  if (!document) return;

  if (document.void) {
    throw new ApiError(
      404,
      `This license was cancelled${
        document.refunded ? " because the order was refunded" : ""
      }`,
    );
  }

  // generate license key file object
  const { plist, name } = await generateLicenseFile(
    document,
    ctx.state.auth.kind,
  );

  // decode the base64-encoded file
  ctx.body = plist;
  ctx.set("Content-Type", "application/octet-stream");
  // fallback should contain only ASCII characters
  const fallback = name.replace(/[^\x20-\x7e]/g, "?");
  ctx.set("Content-Disposition", createCDH(name, { fallback }));
});

// Update a license key
router.patch(matchId.uuid, matchId.pattern, async (ctx) => {
  const data = ZLicenseKeyUpdate.strict().parse(ctx.request.body);
  if (await updateLicenseKey(ctx.params.id, data, ctx.state.auth)) {
    ctx.status = 204;
  }
});
