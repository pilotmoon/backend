import Router = require("@koa/router");
import { randomUUID } from "crypto";
import { AuthContext, createApiKey, lookupById } from "../auth";
import { ApiError } from "../errors";

export const router = new Router({ prefix: "/api_keys" });
const PATH_NAME = randomUUID();

router.post("/", async (ctx, next) => {
  const params = AuthContext.parse(ctx.request.body);
  const document = await createApiKey(params, ctx.state.auth);
  ctx.body = document;
  ctx.status = 201;
  ctx.set("Location", ctx.fullUrl(PATH_NAME, { id: document._id }));
});

router.get(PATH_NAME, "/:id", async (ctx, next) => {
  const id = ctx.params.id;
  const document = await lookupById(id, ctx.state.auth);
  if (!document) {
    throw new ApiError(404, "API key not found");
  }
  ctx.body = document;
});
