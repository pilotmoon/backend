import { Context, Next } from "koa";
import { z } from "zod";
import { ApiError } from "../../errors";
import { idRegex, objectNames, objectNamesWithoutId } from "../identifiers";

// replace _id with id
function replaceId(obj: any) {
  if (obj._id) {
    if (typeof obj._id === "string") {
      obj.id = obj._id;
    }
    delete obj._id;
  }
  return obj;
}

// schema for objects in responses
const ZObject = z.object({
  id: z.string().regex(idRegex),
  object: z.enum(objectNames),
  created: z.date().optional(),
}).passthrough();

// schema for lists in responses
const ZList = z.object({
  object: z.literal("list"),
  items: z.array(ZObject),
}).passthrough();

// generic schema for all responses. this is used to validate and format
// all responses to the client.
const ZResponse = z.union([
  ZObject,
  ZList,
  z.object({
    object: z.enum(objectNamesWithoutId),
  }).passthrough(),
]);

// modify all response bodies.
// also, add livemode key
// we will also check that the client accepts JSON
// and return a 406 (Not Acceptable) if not
export async function formatBody(ctx: Context, next: Next) {
  await next();
  // if body is not an object, don't modify it
  if (typeof ctx.body !== "object" || ctx.body === null) return;

  // check that client accepts JSON
  if (!ctx.accepts("application/json")) {
    throw new ApiError(406, "Client does not accept JSON");
  }

  let newBody;
  if (Array.isArray(ctx.body)) {
    // if array, wrap in list object
    newBody = {
      object: "list",
      paginate: ctx.state.paginate,
      items: ctx.body.map(replaceId),
    };
  } else {
    // otherwise, just replace _id with id
    newBody = replaceId(ctx.body);
  }

  // set livemode key
  newBody.livemode = ctx.state.auth.kind === "live";

  // assign new body
  try {
    ctx.body = ZResponse.parse(newBody);
  } catch (err) {
    console.error(err);
    throw new ApiError(500, "Response validation failed");
  }
}
