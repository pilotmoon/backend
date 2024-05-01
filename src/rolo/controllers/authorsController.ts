// authors collection records who has created extensions
// currently all authors are only on github but there may be other sources in the future
// authors record:
// {
//   _id: au_<12 base62 random>, // primary key
//  object: "author",
//  created: <date>,
//  verified: <boolean>, //optional
//  autoPublish: <boolean>, //optional
//    type: "github", // discriminator
//    githubId: <github user id>, // sparse unique index
//    githubHandle: <github handle>,
//    githubType: <User or Organization>,
//    githubUrl: <github html_url>,
//    avatarUrl: <github avatar url>, //optional
//    websiteUrl: <github blog>, //optional
//    name: <github name>, //optional
//    email: <github email>, //optional
//    bio: <github bio>, //optional
//    company: <github company>, //optional
//    location: <github location>, //optional
//  ... end of "github"" type

import { z } from "zod";
import { Auth, AuthKind, authKinds } from "../auth.js";
import { getDb } from "../database.js";
import { randomIdentifier } from "../identifiers.js";
import { handleControllerError } from "../../common/errors.js";
import { Pagination, paginate } from "../paginate.js";
import { Document } from "mongodb";
import { log } from "../../common/log.js";
import { ZGithubAuthorInfo } from "../../common/extensionSchemas.js";

// what is passed in on creation
export const ZAuthorInfo = z.discriminatedUnion("type", [ZGithubAuthorInfo]);
export type AuthorInfo = z.infer<typeof ZAuthorInfo>;

export const ZAuthorPatch = z.object({
  verified: z.boolean().optional(),
  autoPublish: z.boolean().optional(),
});
export type AuthorPatch = z.infer<typeof ZAuthorPatch>;

// as stored in the database
export const ZAuthorRecord = ZAuthorPatch.extend({
  _id: z.string(),
  object: z.literal("author"),
  created: z.date(),
  info: ZAuthorInfo,
});
export type AuthorRecord = z.infer<typeof ZAuthorRecord>;

const authorsCollectionName = "authors";
// helper function to get the database collection for a given key kind
function dbc(kind: AuthKind) {
  return getDb(kind).collection<AuthorRecord>(authorsCollectionName, {
    ignoreUndefined: true,
  });
}

// called at server startup to create indexes
export async function init() {
  for (const kind of authKinds) {
    const collection = dbc(kind);
    collection.createIndex({ created: 1 });
    collection.createIndex(
      { "info.githubId": 1 },
      { sparse: true, unique: true },
    );
  }
}

// CRUD
export async function createAuthor(info: AuthorInfo, auth: Auth) {
  auth.assertAccess(authorsCollectionName, undefined, "create");
  const now = new Date();
  const record: Document = {
    _id: randomIdentifier("au"),
    object: "author",
    created: now,
  };
  try {
    if (info.type !== "github") {
      throw new Error(`Unsupported author type ${info.type}`);
    }
    const result = await dbc(auth.kind).findOneAndUpdate(
      { "info.githubId": info.githubId },
      { $setOnInsert: record, $set: { info } },
      { upsert: true, returnDocument: "after" },
    );
    log("result", JSON.stringify(result, null, 2));
    if (!result.value) {
      throw new Error("Error inserting document");
    }
    return result.value;
  } catch (e) {
    handleControllerError(e);
    throw e;
  }
}

export async function createAuthorInternal(
  info: AuthorInfo,
  authKind: AuthKind,
) {
  return await createAuthor(
    info,
    new Auth({
      scopes: [`authors:create`],
      kind: authKind,
    }),
  );
}

export async function readAuthor(id: string, auth: Auth) {
  auth.assertAccess(authorsCollectionName, id, "read");
  try {
    const document = await dbc(auth.kind).findOne({ _id: id });
    if (!document) return null;
    return ZAuthorRecord.parse(document);
  } catch (e) {
    handleControllerError(e);
    throw e;
  }
}

export async function readAuthorByGithubId(githubId: number, auth: Auth) {
  auth.assertAccess(authorsCollectionName, `github:${githubId}`, "read");
  try {
    const document = await dbc(auth.kind).findOne({
      "info.githubId": githubId,
    });
    if (!document) return null;
    return ZAuthorRecord.parse(document);
  } catch (e) {
    handleControllerError(e);
    throw e;
  }
}

export async function readAuthorByGithubIdInternal(
  githubId: number,
  authKind: AuthKind,
) {
  return await readAuthorByGithubId(
    githubId,
    new Auth({
      scopes: [`authors/github:${githubId}:read`],
      kind: authKind,
    }),
  );
}

export async function listAuthors(pagination: Pagination, auth: Auth) {
  auth.assertAccess(authorsCollectionName, undefined, "read");
  try {
    const documents = await paginate(dbc(auth.kind), pagination);
    return documents;
  } catch (e) {
    handleControllerError(e);
    throw e;
  }
}

export async function updateAuthor(id: string, patch: AuthorPatch, auth: Auth) {
  auth.assertAccess(authorsCollectionName, id, "update");
  try {
    const result = await dbc(auth.kind).findOneAndUpdate(
      { _id: id },
      { $set: patch },
      { returnDocument: "after" },
    );
    return !!result.value;
  } catch (e) {
    handleControllerError(e);
    throw e;
  }
}

export async function deleteAuthor(id: string, auth: Auth) {
  auth.assertAccess(authorsCollectionName, id, "delete");
  try {
    const result = await dbc(auth.kind).deleteOne({ _id: id });
    return result.deletedCount == 1;
  } catch (e) {
    handleControllerError(e);
    throw e;
  }
}
