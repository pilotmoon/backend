import { Context, Next } from "koa";
import { z } from "zod";
import { ApiError } from "../errors";

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

// generic schema for all responses. this is used to format
// all responses to the client. it will ensure that the response
// has an id key, an object key, and a livemode key. it will also
// ensure that those keys and certain other keys are in a consistent
// order.
const ZResponseSchema = z.object({
  id: z.string(),
  object: z.string(),
  livemode: z.boolean(),
  created: z.date().optional(),
});

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
  ctx.body = ZResponseSchema.passthrough().parse(newBody);
}
