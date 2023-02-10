import Router = require("@koa/router");
import { randomUUID } from "crypto";
import { ApiKeyParams, createApiKey } from "../auth";

export const router = new Router({ prefix: "/apikeys" });
const PATH_NAME = randomUUID();

router.post("/", async (ctx, next) => {
  const params = ApiKeyParams.parse(ctx.request.body);
  const document = await createApiKey(params);
  ctx.body = document;
  ctx.status = 201;
  ctx.set("Location", ctx.fullUrl(PATH_NAME, { id: document._id }));
});

router.get(PATH_NAME, "/:id", async (ctx, next) => {
});
