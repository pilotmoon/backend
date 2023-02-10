"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const Router = require("@koa/router");
const auth_1 = require("../auth");
const router = new Router();
exports.router = router;
router.post("/apikeys", async (ctx, next) => {
  const params = auth_1.ApiKeyParams.parse(ctx.request.body);
  ctx.body = await (0, auth_1.createApiKey)(params);
});
