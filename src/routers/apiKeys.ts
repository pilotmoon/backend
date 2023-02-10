import Router = require("@koa/router");
import { ApiKeyParams, createApiKey } from "../auth";

const router = new Router();

router.post("/apikeys", async (ctx, next) => {
  const params = ApiKeyParams.parse(ctx.request.body);
  ctx.body = await createApiKey(params);
});

export { router };
