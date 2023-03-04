// a middleware to log the access to the server
// the log is written to the database collection, "logs"
// with the following fields:
//   - timestamp: the time the request was received
//   - method: the HTTP method of the request
//   - path: the path of the request
//   - status: the HTTP status code of the response
//   - duration: the time taken to process the request
//   - ips: ip address of the client and any proxies
//   - userAgent: the user agent string of the client, if provided
//   - keyId: the key id of the request, if applicable
//   - authKind: the auth kind of the request, if applicable
//   - authScopes: the auth scopes of the request, if applicable
//   - authExpires: the auth expiration of the request, if applicable
import { Context, Next } from "koa";
import { getDb } from "../database";
import { z } from "zod";
import { union } from "lodash";
import { ZAuthInfo } from "../auth";

const ZLogSchema = z.object({
  timestamp: z.date(),
  method: z.string(),
  path: z.string(),
  ips: z.array(z.string()).nonempty(),
  userAgent: z.string().optional(),
  status: z.number(),
  duration: z.number(),
  apiKeyId: z.string().optional(),
  auth: ZAuthInfo.optional(),
});
export type LogSchema = z.infer<typeof ZLogSchema>;

export function init() {
  // create the index on the timestamp field
  gc().createIndex({ timestamp: -1 });
}

function gc() {
  return getDb("logs").collection<LogSchema>("logs");
}

// note, we use a separate database for the logs. this is because
// we don't always know the key kind when we log the access.
export async function logAccess(ctx: Context, next: Next) {
  const start = Date.now();
  await next();
  const duration = Date.now() - start;
  const { method, path, ips, status, header } = ctx;
  const userAgent = header["user-agent"];
  const { apiKeyId, auth } = ctx.state;
  const log = {
    timestamp: new Date(),
    method,
    path,
    ips: union(ips, [ctx.ip]),
    userAgent,
    status,
    duration,
    apiKeyId,
    auth,
  };
  // no need to await this because it does no harm if it fails
  // and we don't want to slow down the response
  gc().insertOne(ZLogSchema.parse(log));
}
