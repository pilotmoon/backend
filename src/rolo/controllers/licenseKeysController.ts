import { AquaticPrime } from "@pilotmoon/aquatic-prime";
import type { Document } from "mongodb";
import { z } from "zod";
import { handleControllerError } from "../../common/errors.js";
import {
  ZSaneDate,
  ZSaneEmail,
  ZSaneIdentifier,
  ZSaneQuantity,
  ZSaneString,
} from "../../common/saneSchemas.js";
import type { Auth } from "../auth.js";
import { type AuthKind, authKinds } from "../auth.js";
import { hashEmail } from "../canonicalizeEmail.js";
import { getClient, getDb } from "../database.js";
import { randomIdentifier } from "../identifiers.js";
import { type PortableKeyPair, ZPortableKeyPair } from "../keyPair.js";
import { type Pagination, paginate } from "../paginate.js";
import { type ProductConfig, ZProductConfig } from "../product.js";
import { sanitizeName } from "../sanitizeName.js";
import { decryptInPlace, encryptInPlace } from "../secrets.js";
import { getQueryPipeline } from "./licenseKeysQuery.js";
import { getRegistryObjectInternal as getreg } from "./registriesController.js";
/*

# License Keys

## Example

An example license key file, in Apple Property List format (Plist),
which corresponds to a license key record in the database.

<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Date</key>
    <string>2021-10-02</string>
    <key>Expiry Date</key>
    <string>2024-10-02</string>
    <key>Email</key>
    <string>kuntau17@gmail.com</string>
    <key>Name</key>
    <string>Kuntau</string>
    <key>Order</key>
    <string>244001-443922 (DIGITALYCHEE)</string>
    <key>Product</key>
    <string>com.pilotmoon.popclip/Special license</string>
    <key>Quantity</key>
    <string>3</string>
    <key>Signature</key>
    <data>
    G120nhjyBQ6qV8cbReR7P1aWQ+VZ1a/uKjEiqvqZBElevebmT5zi0C7JG7K1OEzY5y9f
    HbFaq91jjgOo2UmbfljxZVq3MQm0xsEtc8JK803tCTHLpSJL36RwJ48pHp9Dn5ng/54V
    GTQzxsWHS1SIvS3dijNdbnqFstKEXUCH48k=
    </data>
</dict>
</plist>

## License Key File Format

The license key file is signed with the private key for the associated product.

Noe that the Product field is a combination of the product identifier and the
description, separated by a forward slash. If there is no description, the
Product field is just the product identifier.

The Order field is a combination of the order number and the origin, at the end
of the string and enclosed in parentheses. If there is no origin,
the Order field is just the order number.

The Date and Expiry Date fields are strings in one of two formats:
- YYYY-MM-DD (preferred)
- 1 or 2 digit date, 3 letter month, and full year e.g. "2 Oct 2021"
Licenses should be generated with the preferred format, but the other format
is supported when PopClip reads license keys for backwards compatibility.

The Quantity field is optional. If it is not present, the license key is
valid for 1 user only. If it is present, the license key is valid for the
number of users specified in the Quantity field.

The Signature field is a Base64-encoded signature of the license key file
content, using the private key for the associated product. The signature
is generated using the AquaticPrime library.

The Signature field is not stored in the database. Instead, it is generated
on demand from the license key record. Similarly, the license key file itself
is generated on demand.

## License Key File Name

The plist file also has an associated filename. The filename is a derived from
the licensee name, sanitised to replace spaces and punctuation with underscores,
and then suffixed with a file extension such as ".popcliplicense". The filename
is not stored in the database. Instead, it is generated on demand from the
license key record. The file suffix is different for each product, and is
looked up from the product record in the database.

## License Key Generation

The license key record is generated by the server when a new license key is
created. The license key record is stored in the database, and the license
key file is generated on demand.

The license date is set to the current date at the time of creation.
When the plist is generated, the date is formatted in YYYY-MM-DD format
using the Europe/London timezone. (Since the server is in the UK, this
is the timezone that is used for all dates when they are represented
without a timezone.)

Most of the field are stored in the database in plain text. The only
sensitive fields are the name and email address, which are encrypted
using the application key. A sha256 hash of the email address is also
stored in the database, to allow the email address to be looked up
without decrypting it.

## Endpoints

### GET /licenseKeys

Returns a list of license keys.

### POST /licenseKeys

Creates a new license key.

### GET /licenseKeys/:id

Returns a license key record.

### PATCH /licenseKeys/:id

Updates a license key's details such as name and email address.
The range of fields that can be updated is limited to prevent
accidental changes to the product, order, and date fields.

### DELETE /licenseKeys/:id

Deletes a license key.

### GET /licenseKeys/:id/file

Returns a license key file in Apple Property List format (Plist).
If the Accept header allows "application/octet-stream", the endpoint
returns the license key file content, with the appropriate
Content-Type header and filename indicated in the Content-Disposition
header. This allows the browser to download the file directly.

*/

/*** Database ***/

export const collectionName = "licenseKeys";
// helper function to get the database collection for a given key kind
function dbc(kind: AuthKind) {
  return getDb(kind).collection<LicenseKeyRecord>(collectionName);
}

// called at server startup to create indexes
export async function init() {
  for (const kind of authKinds) {
    const collection = dbc(kind);
    collection.createIndex({ created: 1 });
    collection.createIndex({ origin: 1 });
  }
}

/*** Schemas ***/

// Schema for the parts of the license key record that can be provided at
// creation time. Note that only the name and product fields are required
export const ZLicenseKeyInfo = z.object({
  // name of the license key owner
  name: ZSaneString,
  // email address of the licensee
  email: ZSaneEmail.optional(),
  // date of purchase (set automatically when license key is created,
  // but can be set manualy for imported license keys)
  date: ZSaneDate.optional(),
  // expiry date of license key (optional)
  expiryDate: ZSaneDate.optional(),
  // licensed product identifier (e.g. "com.pilotmoon.popclip")
  product: ZSaneIdentifier,
  // number of users/seats covered by the license key
  quantity: ZSaneQuantity.optional(),
  // description of the license key e.g. "Special license"
  description: ZSaneString.optional(),
  // name of entity that created license, e.g. "DIGITALYCHEE" or "FastSpring"
  origin: ZSaneString.optional(),
  // other data supplied by the origin e.g. additional transction info
  originData: z.unknown().optional(),
  // order number supplied by origin, e.g. "123456789"
  order: ZSaneString.optional(),
  // whether the license key has been voided
  void: z.boolean().optional(),
  // whether the license key has been refunded
  refunded: z.boolean().optional(),
  // note about the license key
  note: z.string().optional(),
  // valid before OS
  validBeforeOs: z.string().optional(),
  // valid before version
  validBeforeVersion: z.string().optional(),
});
export type LicenseKeyInfo = z.infer<typeof ZLicenseKeyInfo>;
const encryptedFields = ["name", "email"] as const;

// schema for the parts of the info that can be updated later
export const ZLicenseKeyUpdate = ZLicenseKeyInfo.pick({
  name: true,
  email: true,
  expiryDate: true,
  quantity: true,
  validBeforeOs: true,
  validBeforeVersion: true,
  description: true,
  // these ones dont go into the actual license key:
  void: true,
  refunded: true,
  note: true,
}).partial();
export type LicenseKeyUpdate = z.infer<typeof ZLicenseKeyUpdate>;

// schema for full license key record stored in database
export const ZLicenseKeyRecord = ZLicenseKeyInfo.extend({
  // unique identifier for the license key, with prefix "lk_"
  _id: z.string(),
  // literal string "licenseKey"
  object: z.literal("licenseKey"),
  // date of creation of record
  created: z.date(),
  // sha256 hash of the email address, in hex
  emailHash: z
    .string()
    .regex(/^[0-9a-f]{64}$/)
    .optional(),
  // array of identifying aquaticPrime hashes of the license key file content, in hex
  hashes: z.array(z.string().regex(/^[0-9a-f]{40}$/)).optional(),
});
export type LicenseKeyRecord = z.infer<typeof ZLicenseKeyRecord>;

const ZLicenseFileObject = z.object({
  // literal string "licenseKeyFile"
  object: z.literal("licenseKeyFile"),
  // license key filename, e.g. "John_Doe.popcliplicense"
  name: z.string(),
  // this license's identifying sha1 hash in hex
  hash: z.string().regex(/^[0-9a-f]{40}$/),
  // license file content as plist string
  plist: z.string(),
  // license key file content, as a Base64-encoded string
  data: z.string(),
});
type LicenseFileObject = z.infer<typeof ZLicenseFileObject>;

/*** C.R.U.D. Operations ***/

// Create a new license key using the given info.
// The auth context must have the "licenseKeys:create" scope.
export async function createLicenseKey(
  info: LicenseKeyInfo,
  auth: Auth,
): Promise<LicenseKeyRecord> {
  const now = new Date();
  auth.assertAccess(collectionName, undefined, "create");
  if (!info.date) info.date = now;
  const document: LicenseKeyRecord = {
    _id: randomIdentifier("lk"),
    object: "licenseKey" as const,
    created: now,
    ...info,
  };

  // hash the email address if it exists
  if (info.email) document.emailHash = hashEmail(info.email);

  // populate the hashes field with the initial hash
  const { hash } = await generateLicenseFile(document, auth.kind);
  document.hashes = [hash];

  try {
    encryptInPlace(document, encryptedFields);
    await dbc(auth.kind).insertOne(document);
    decryptInPlace(document);
    return document;
  } catch (error) {
    handleControllerError(error);
    throw error;
  }
}

// Get a license key record by ID.
// The auth context must have the "licenseKeys:read" scope.
export async function readLicenseKey(
  id: string,
  auth: Auth,
): Promise<LicenseKeyRecord | null> {
  auth.assertAccess(collectionName, id, "read");
  const document = await dbc(auth.kind).findOne({ _id: id });
  if (!document) return null;

  try {
    decryptInPlace(document);
    return ZLicenseKeyRecord.parse(document);
  } catch (error) {
    handleControllerError(error);
    throw error;
  }
}

// Update a license key record.
// The auth context must have the "licenseKeys:update" scope.
// Returns true if the registry was updated, false if it was not found.
export async function updateLicenseKey(
  id: string,
  update: LicenseKeyUpdate,
  auth: Auth,
): Promise<boolean> {
  auth.assertAccess(collectionName, id, "update");
  const session = getClient().startSession();
  try {
    let document: LicenseKeyRecord | null = null;
    await session.withTransaction(async () => {
      document = await dbc(auth.kind).findOne({ _id: id });
      if (!document) return;

      decryptInPlace(document);
      if (update.email) document.emailHash = hashEmail(update.email);
      const updated = { ...document, ...update };

      // generate the hashes array if needed
      if (!Array.isArray(updated.hashes)) updated.hashes = [];
      // if the hash has changed, add it to the hashes array
      const { hash } = await generateLicenseFile(updated, auth.kind);
      if (!updated.hashes.includes(hash)) updated.hashes.push(hash);

      encryptInPlace(updated, encryptedFields);
      await dbc(auth.kind).updateOne({ _id: id }, { $set: updated });
    });
    return !!document;
  } catch (error) {
    handleControllerError(error);
    throw error;
  }
}

export async function listLicenseKeys(
  query: unknown,
  pagination: Pagination,
  auth: Auth,
): Promise<Document[]> {
  auth.assertAccess(collectionName, undefined, "read");
  const pipeline = getQueryPipeline(query);
  try {
    const docs = await paginate(dbc(auth.kind), pagination, pipeline);
    for (const doc of docs) decryptInPlace(doc);
    return docs;
  } catch (error) {
    handleControllerError(error);
    throw error;
  }
}

// how the fields should be set out in a standard license key file
// (note - alphabetical order, to match License Utility)
const ZLicenseFileFields = z.object({
  Date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  Email: z.string().optional(),
  "Expiry Date": z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  Name: z.string(),
  Order: z.string().optional(),
  Product: z.string(),
  Quantity: z.string().optional(),
  "Valid Before OS": z.string().optional(),
  "Valid Before Version": z.string().optional(),
});
type LicenseFileFields = z.infer<typeof ZLicenseFileFields>;

// generate license file content and file name for a license key
export async function generateLicenseFile(
  document: LicenseKeyRecord,
  authKind: AuthKind,
): Promise<LicenseFileObject> {
  // first look up the key pair for the product.
  // it will be stored in a registry with the product id
  // as its identifier, and the object name will be aquaticPrimeKeyPair.
  const keyPair = await getAquaticPrimeKeyPair(document.product, authKind);
  const config = await getProductConfig(document.product, authKind);

  const aqp = new AquaticPrime(keyPair);
  const details: LicenseFileFields = {
    Name: document.name,
    Product: document.product,
  };
  if (document.email) {
    details.Email = document.email;
  }
  if (document.date) {
    details.Date = document.date.toISOString().slice(0, 10);
  }
  if (document.expiryDate) {
    details["Expiry Date"] = document.expiryDate.toISOString().slice(0, 10);
  }
  if (document.quantity && document.quantity > 1) {
    details.Quantity = document.quantity.toString();
  }
  if (document.order) {
    if (document.origin) {
      details.Order = `${document.order} (${document.origin})`;
    } else {
      details.Order = document.order;
    }
  }
  if (document.description) {
    details.Product = `${document.product}/${document.description}`;
  }
  if (document.validBeforeOs) {
    details["Valid Before OS"] = document.validBeforeOs;
  }
  if (document.validBeforeVersion) {
    details["Valid Before Version"] = document.validBeforeVersion;
  }

  // generate the license file content
  const { signedPlist: plist, hashHex: hash } = aqp.generateLicense(
    ZLicenseFileFields.parse(details),
  );

  // generate the license file name
  const name = `${sanitizeName(document.name, "License")}.${
    config.licenseFileExtension
  }`;

  return ZLicenseFileObject.parse({
    object: "licenseKeyFile",
    plist,
    hash,
    data: Buffer.from(plist).toString("base64"),
    name,
  });
}

// get the aquatic prime key pair for a product
async function getAquaticPrimeKeyPair(
  product: string,
  authKind: AuthKind,
): Promise<PortableKeyPair> {
  const keyPair = await getreg(product, "aquaticPrimeKeyPair", authKind);
  if (!keyPair) throw new Error(`No key pair found for product ${product}`);
  return ZPortableKeyPair.parse(keyPair);
}

// get the product config for a product
export async function getProductConfig(
  product: string,
  authKind: AuthKind,
): Promise<ProductConfig> {
  const config = await getreg(product, "config", authKind);
  if (!config) throw new Error(`No config found for product ${product}`);
  return ZProductConfig.parse(config);
}
