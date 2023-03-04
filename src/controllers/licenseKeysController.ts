import { z } from "zod";
import { getDb } from "../database";
import { Auth } from "../auth";
import { handleControllerError } from "../errors";
import { genericIdRegex, randomIdentifier, ZSaneString } from "../identifiers";
import { PortableKeyPair, ZPortableKeyPair } from "../keyPair";
import { AquaticPrime, LicenseDetails } from "@pilotmoon/aquatic-prime";
import { sha256Hex } from "../sha256";
import { decryptInPlace, encryptInPlace } from "../secrets";
import { canonicalizeEmail } from "../canonicalizeEmail";
import { AuthKind, authKinds } from "../auth";
import {
  getRegistryObject,
  readRegistry,
  ZRecord,
} from "./registriesController";
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
returns the license key file content directly, with the appropriate
Content-Type header and filename indicated in the Content-Disposition
header. This allows the browser to download the file directly.

Otherwise, the endpoint returns JSON with three fields:
- object: "licenseKeyFile"
- filename: the filename of the license key file
- data: the license key file content, as a Base64-encoded string
This is useful for testing, and for external servers that want to
access the license key file content using an API call.

*/

/*** Database ***/

const collectionName = "licenseKeys";
// helper function to get the database collection for a given key kind
function dbc(kind: AuthKind) {
  return getDb(kind).collection<LicenseKeyRecord>(collectionName);
}

// called at server startup to create indexes
export async function init() {
  for (const kind of authKinds) {
    const collection = dbc(kind);
    collection.createIndex({ created: 1 });
  }
}

/*** Schemas ***/

// Schema for the parts of the license key record that can be provided at
// creation time. Note that only the name and product fields are required
export const ZLicenseKeyInfo = z.object({
  // name of the license key owner
  name: ZSaneString,
  // email address of the licensee
  email: z.string().trim().email().max(100).optional(),
  // date of purchase (set automatically when license key is created,
  // but can be set manualy for imported license keys)
  date: z.coerce.date().min(new Date("2010-01-01")).optional(),
  // expiry date of license key (optional)
  expiryDate: z.coerce.date().min(new Date("2010-01-01")).optional(),
  // licensed product identifier (e.g. "com.pilotmoon.popclip")
  product: z.string().regex(genericIdRegex).max(100),
  // number of users/seats covered by the license key
  quantity: z.number().int().positive().optional(),
  // description of the license key e.g. "Special license"
  description: ZSaneString.optional(),
  // name of entity that created license, e.g. "DIGITALYCHEE" or "FastSpring"
  origin: z.string().trim().max(100).optional(),
  // order number supplied by origin, e.g. "123456789"
  order: z.string().trim().max(100).optional(),
});
export type LicenseKeyInfo = z.infer<typeof ZLicenseKeyInfo>;
const encryptedFields = ["name", "email"] as const;

// schema for the parts of the info that can be updated later
export const ZLicenseKeyUpdate = ZLicenseKeyInfo.pick({
  name: true,
  email: true,
}).optional();

// schema for full license key record stored in database
export const ZLicenseKeyRecord = ZLicenseKeyInfo.extend({
  // unique identifier for the license key, with prefix "lk_"
  _id: z.string(),
  // literal string "licenseKey"
  object: z.literal("licenseKey"),
  // date of creation of record
  created: z.date(),
  // sha256 hash of the email address, in hex
  emailHash: z.string().regex(/^[0-9a-f]{64}$/).optional(),
});
export type LicenseKeyRecord = z.infer<typeof ZLicenseKeyRecord>;

// schema for what is returned to the client, comprising the full record
// plus the license key file content and generated filename
export const ZLicenseKey = ZLicenseKeyRecord.extend({
  // license key file content, as a Base64-encoded string
  data: z.string(),
  // license key filename, e.g. "John_Doe.popcliplicense"
  filename: z.string(),
});
export type LicenseKey = z.infer<typeof ZLicenseKey>;

// schema for the wrapper for the license key file
export const ZLicenseKeyFile = z.object({
  // literal string "licenseKeyFile"
  object: z.literal("licenseKeyFile"),
  // license key file content, as a Base64-encoded string
  data: z.string(),
  // license key filename, e.g. "John_Doe.popcliplicense"
  filename: z.string(),
});
export type LicenseKeyFile = z.infer<typeof ZLicenseKeyFile>;

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
  if (info.email) document.emailHash = sha256Hex(canonicalizeEmail(info.email));

  try {
    encryptInPlace(document, auth.kind, encryptedFields);
    await dbc(auth.kind).insertOne(document);
    decryptInPlace(document, auth.kind);
    return document;
  } catch (error) {
    handleControllerError(error);
    throw (error);
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
    decryptInPlace(document, auth.kind);
    return ZLicenseKeyRecord.parse(document);
  } catch (error) {
    handleControllerError(error);
    throw (error);
  }
}

// how the fields should be set out in a standard license key file
// (note - alphabertical order, to match License Utility)
const ZLicenseFileFields = z.object({
  Date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  Email: z.string().trim().email().max(100).optional(),
  "Expiry Date": z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  Name: z.string(),
  Order: z.string().optional(),
  Product: z.string(),
  Quantity: z.string().optional(),
});
type LicenseFileFields = z.infer<typeof ZLicenseFileFields>;

// configuration for generating license key files
const ZLicenceKeysConfig = z.object({
  // name of the product, e.g. "PopClip"
  productName: ZSaneString,
  // file extension for the license key file, e.g. "popcliplicense"
  licenseFileExtension: ZSaneString,
});
type LicenseKeysConfig = z.infer<typeof ZLicenceKeysConfig>;

// generate license file content and file name for a license key
export async function generateLicenseFile(
  document: LicenseKeyRecord,
  auth: Auth,
): Promise<LicenseKeyFile> {
  // first look up the key pair for the product.
  // it will be stored in a registry with the product id
  // as its identifier, and the object name will be aquaticPrimeKeyPair.
  const keyPair = await getAquaticPrimeKeyPair(document.product, auth);
  const config = await getLicenseKeysConfig(document.product, auth);

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

  // generate the license file content
  const licensePlist = aqp.generateLicense(ZLicenseFileFields.parse(details));

  // generate the license file name
  const filename = sanitizedName(document.name) + "." +
    config.licenseFileExtension;

  return {
    object: "licenseKeyFile",
    data: Buffer.from(licensePlist).toString("base64"),
    filename,
  };
}

function sanitizedName(name: string) {
  let result = name.replace(/[^\w]/g, "_");
  // then replace multiple underscores with a single underscore
  result = result.replace(/_+/g, "_");
  // then trim leading and trailing underscores
  result = result.replace(/^_+|_+$/g, "");
  return result;
}

async function getAquaticPrimeKeyPair(
  productId: string,
  auth: Auth,
): Promise<PortableKeyPair> {
  const keyPair = await getRegistryObject(
    productId,
    "aquaticPrimeKeyPair",
    auth,
  );
  return ZPortableKeyPair.parse(keyPair);
}

async function getLicenseKeysConfig(
  productId: string,
  auth: Auth,
): Promise<LicenseKeysConfig> {
  const config = await getRegistryObject(productId, "config", auth);
  return ZLicenceKeysConfig.parse(ZRecord.parse(config).record);
}
