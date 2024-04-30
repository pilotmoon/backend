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
    _id: blob_<base58 encoded h2, truncated to last 20 chars>,
    object: "blob",
    data: <blob binary data>,
    size: <size of blob data in bytes>,
    h1: "<20 bytes lowercase hex>", # git hash sha1
    h2: "<32 bytes lowercase hex>", # git hash sha256
    ]
}
```

Indexes:
- `h1` and `h2` indexed with a unique constraint to ensure that no two blobs have the same hashes.

If a new blob is added with a hash that already exists, the new blob is ignored and the existing
blob is kept.
/*/

import { Binary, Document, MongoServerError } from "mongodb";
import { z } from "zod";
import { handleControllerError } from "../../common/errors.js";
import { NonNegativeSafeInteger } from "../../common/saneSchemas.js";
import { Auth, AuthKind, authKinds } from "../auth.js";
import { getDb } from "../database.js";
import { Pagination, paginate } from "../paginate.js";
import {
  ZBlobHash,
  ZBlobHash2,
  gitHash,
  truncatedHash,
} from "../../common/blobSchemas.js";
import { log } from "../../common/log.js";

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
    collection.createIndex({ h1: 1 }, { unique: true });
    collection.createIndex({ h2: 1 }, { unique: true });
  }
}

/*** Schemas ***/
export const ZBlobCoreRecord = z.object({
  _id: z.string(),
  object: z.literal("blob"),
  created: z.date(),
  h1: ZBlobHash,
  h2: ZBlobHash2,
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

/** C.R.U.D. **/
const maxBlobSize = 5 * 1024 * 1024;

export async function createBlob(data: Buffer, auth: Auth) {
  auth.assertAccess(blobsCollectionName, undefined, "create");

  // decode base64 data and check size
  if (data.length > maxBlobSize) {
    throw new Error(`Blob size exceeds the maximum of ${maxBlobSize} bytes`);
  }

  // prepare hashes
  const gitHashSha1 = gitHash(data, "sha1");
  const gitHashSha256 = gitHash(data, "sha256");

  const collection = dbc(auth.kind);
  try {
    const document: BlobBinaryRecord = {
      _id: `blob_${truncatedHash(gitHashSha256)}`,
      object: "blob",
      created: new Date(),
      h1: gitHashSha1.toString("hex"),
      h2: gitHashSha256.toString("hex"),
      size: data.length,
      data: new Binary(data),
    };
    let isDuplicate = false;
    // use this method to ensure the check and set are atomic
    // in unlikely case of collision of any hash (such that any of
    // _id, h1 or h2 is repeated in another blob record), this will throw
    // a duplicate key error
    await collection.replaceOne(
      { _id: document._id, h1: document.h1, h2: document.h2 },
      document,
      { upsert: true },
    );
    return { document: ZBlobCoreRecord.parse(document), isDuplicate };
  } catch (error) {
    handleControllerError(error);
    throw error;
  }
}

// get a blob by id or hash
export async function readBlob(id: string, auth: Auth, includeData: boolean) {
  auth.assertAccess(blobsCollectionName, id, "read");
  try {
    const filter = ((id: string) => {
      if (id.startsWith("blob_")) {
        return { _id: id };
      } else if (id.length === 20) {
        return { _id: `blob_${id}` };
      } else if (id.length === 40) {
        return { h1: id };
      } else if (id.length === 64) {
        return { h2: id };
      } else {
        return null;
      }
    })(id);
    if (!filter) return null;
    const document = await dbc(auth.kind).findOne(filter);
    if (!document) return null;
    return ZBlobBufferRecord.parse({
      ...document,
      dataBuffer: includeData ? Buffer.from(document.data.buffer) : undefined,
    });
  } catch (error) {
    handleControllerError(error);
    throw error;
  }
}

// get object for internal application use
export async function readBlobInternal(
  identifier: string,
  kind: AuthKind,
  includeData: boolean,
) {
  return await readBlob(
    identifier,
    new Auth({
      scopes: [`blobs/${identifier}:read`],
      kind: kind,
    }),
    includeData,
  );
}

export async function listBlobs(
  hashes: string[],
  auth: Auth,
  pagination: Pagination,
) {
  auth.assertAccess(blobsCollectionName, undefined, "list");
  try {
    const pipeline: Document[] = [];
    if (hashes.length > 0) {
      pipeline.push({
        $match: { $or: [{ h1: { $in: hashes } }, { h2: { $in: hashes } }] },
      });
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
