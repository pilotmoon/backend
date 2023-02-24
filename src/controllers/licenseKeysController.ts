import { z } from "zod";
import { getDb } from "../database";
import { assertScope, AuthContext } from "../controllers/authController";
import { handleControllerError } from "../errors";
import { KeyKind, keyKinds, randomIdentifier } from "../identifiers";
import { PaginateState } from "../middleware/processPagination";
import { ZPortableKeyPair } from "../keyPair";
import { decryptInPlace, encryptInPlace } from "../secrets";

/*
An example license key file, generated from a license key record.

<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>Date</key>
	<string>2021-10-02</string>
	<key>Email</key>
	<string>kuntau17@gmail.com</string>
	<key>Name</key>
	<string>Kuntau</string>
	<key>Order</key>
	<string>244001-443922 (DIGITALYCHEE)</string>
	<key>Product</key>
	<string>com.pilotmoon.popclip</string>
	<key>Signature</key>
	<data>
	G120nhjyBQ6qV8cbReR7P1aWQ+VZ1a/uKjEiqvqZBElevebmT5zi0C7JG7K1OEzY5y9f
	HbFaq91jjgOo2UmbfljxZVq3MQm0xsEtc8JK803tCTHLpSJL36RwJ48pHp9Dn5ng/54V
	GTQzxsWHS1SIvS3dijNdbnqFstKEXUCH48k=
	</data>
</dict>
</plist>

The license key file is signed with the private key for the associated product.
The license key file itself is not stored in the database. Instead, it is
generated on demand from the license key record.

*/

/*** Database ***/

// helper function to get the database collection for a given key kind
function dbc(kind: KeyKind) {
  return getDb(kind).collection<LicenseKeyRecord>("licenseKeys");
}

// called at server startup to create indexes
export async function init() {
  for (const kind of keyKinds) {
    const collection = dbc(kind);
    collection.createIndex({ created: 1 });
  }
}

/*** Schemas ***/

export const ZLicenseKeyInfo = z.object({
  name: z.string(), // name of the license key owner
  email: z.string(), // email address of the license key owner
  order: z.string(), // original order number from originator (e.g. "244001-443922")
  originator: z.string().optional(), // e.g. "DIGITALYCHEE"
  productBundleId: z.string(), // licensed product bundle ID e.g. "com.pilotmoon.popclip"
});
export type LicenseKeyInfo = z.infer<typeof ZLicenseKeyInfo>;
export const ZPartialLicenseKeyInfo = ZLicenseKeyInfo.partial();
export type PartialLicenseKeyInfo = z.infer<typeof ZPartialLicenseKeyInfo>;
export const ZLicenseKeyRecord = ZLicenseKeyInfo.extend({
  _id: z.string(),
  object: z.literal("licenseKey"),
  created: z.date(),
});
export type LicenseKeyRecord = z.infer<typeof ZLicenseKeyRecord>;
