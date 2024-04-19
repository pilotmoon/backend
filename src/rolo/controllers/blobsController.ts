/*
Blobs are arbitrary chunks of data addressed by hash.
A goal of the store is interoperability with git.
The blob store stores git-sha1 hash.
The hash itself is stored as a lowercase hex string.
The hash is constructed by prepending an ASCII header to the blob content:
`blob <size>\0<content>` where `<size>` is the size of the content in bytes encoded as ASCII decimal.

Maximum blob size is nMB (n x 1024 x 1024 bytes). This is to fit within the
maximum MongoDB document size of 16MB and allow for metadata.

Blobs can be retreived multiple at a time, by providing a list of hashes.

Blob store layout:

```
{
    _id: blob_unique_id,
    object: "blob",
    data: <blob binary data>,
    size: <size of blob data in bytes>,
    hash: "<20 bytes lowercase hex>",
    ]
}
```

Indexes:
- `hashes` is indexed with a unique constraint to ensure that no two blobs have the same hash.

If a new blob is added with a hash that already exists, the new blob is ignored and the existing
blob is kept.
/*/

import { Binary, Document } from "mongodb";
import { createHash } from "node:crypto";
import { z } from "zod";
import { handleControllerError } from "../../common/errors.js";
import { log } from "../../common/log.js";
import { NonNegativeSafeInteger } from "../../common/saneSchemas.js";
import { Auth, AuthKind, authKinds } from "../auth.js";
import { getClient, getDb } from "../database.js";
import { randomIdentifier } from "../identifiers.js";
import { Pagination, paginate } from "../paginate.js";
import { BlobHash, ZBlobHash } from "../../common/blobSchemas.js";

/*** Database ***/

const blobsCollectionName = "blobs";
// helper function to get the database collection for a given key kind
function dbc(kind: AuthKind) {
  return getDb(kind).collection<BlobBinaryRecord>(blobsCollectionName);
}

// called at server startup to create indexes
export async function init() {
  for (const kind of authKinds) {
    const collection = dbc(kind);
    collection.createIndex({ created: 1 });
    collection.createIndex({ hash: 1 }, { unique: true });
  }
}

/*** Schemas ***/
export const ZBlobCoreRecord = z.object({
  _id: z.string(),
  object: z.literal("blob"),
  created: z.date(),
  hash: ZBlobHash,
  size: NonNegativeSafeInteger,
});

export const ZBlobBufferRecord = ZBlobCoreRecord.extend({
  dataBuffer: z.instanceof(Buffer).optional(),
});
export type BlobBufferRecord = z.infer<typeof ZBlobBufferRecord>;

export const ZBlobBinaryRecord = ZBlobCoreRecord.extend({
  data: z.instanceof(Binary),
});
export type BlobBinaryRecord = z.infer<typeof ZBlobBinaryRecord>;

function gitHash(data: Buffer) {
  const header = `blob ${data.length}\0`;
  const buffer = Buffer.concat([Buffer.from(header), data]);
  return createHash("sha1").update(buffer).digest("hex");
}

/** C.R.U.D. **/
const maxBlobSize = 5 * 1024 * 1024;

export async function createBlob(data: Buffer, auth: Auth) {
  auth.assertAccess(blobsCollectionName, undefined, "create");

  // decode base64 data and check size
  if (data.length > maxBlobSize) {
    throw new Error(`Blob size exceeds the maximum of ${maxBlobSize} bytes`);
  }

  // prepare hash
  const hash = gitHash(data);

  // check if blob already exists
  const session = getClient().startSession();
  const collection = dbc(auth.kind);
  try {
    let document: BlobBinaryRecord | null = null;
    let isDuplicate = false;
    await session.withTransaction(async () => {
      // check if blob already exists
      const existingDocument = await collection.findOne({ hash });
      if (existingDocument) {
        log(`Blob already exists, id ${existingDocument._id}`);
        document = existingDocument;
        isDuplicate = true;
        return;
      }
      // create new blob
      document = {
        _id: randomIdentifier("blob"),
        object: "blob",
        created: new Date(),
        hash,
        size: data.length,
        data: new Binary(data),
      };
      await collection.insertOne(document);
    });
    return { document: ZBlobCoreRecord.parse(document), isDuplicate };
  } catch (error) {
    handleControllerError(error);
    throw error;
  } finally {
    session.endSession();
  }
}

// get a blob by id or hash
export async function readBlob(id: string, auth: Auth, includeData: boolean) {
  auth.assertAccess(blobsCollectionName, id, "read");
  const document = await dbc(auth.kind).findOne({
    $or: [{ _id: id }, { hash: id }],
  });
  if (!document) return null;

  try {
    return ZBlobBufferRecord.parse({
      ...document,
      dataBuffer: includeData ? Buffer.from(document.data.buffer) : undefined,
    });
  } catch (error) {
    handleControllerError(error);
    throw error;
  }
}

export async function listBlobs(
  hashes: BlobHash[],
  auth: Auth,
  pagination: Pagination,
) {
  auth.assertAccess(blobsCollectionName, undefined, "list");
  try {
    const pipeline: Document[] = [];
    if (hashes.length > 0) {
      pipeline.push({ $match: { hash: { $in: hashes } } });
    }
    pipeline.push({ $project: { data: 0 } });
    const documents = await paginate<BlobBinaryRecord>(
      dbc(auth.kind),
      pagination,
      pipeline,
    );

    return documents.map((document) => {
      return ZBlobBufferRecord.parse(document);
    });
  } catch (error) {
    handleControllerError(error);
    throw error;
  }
}

export async function deleteBlob(id: string, auth: Auth) {
  auth.assertAccess(blobsCollectionName, id, "delete");
  try {
    const result = await dbc(auth.kind).deleteOne({ _id: id });
    return result.deletedCount === 1;
  } catch (error) {
    handleControllerError(error);
    throw error;
  }
}
