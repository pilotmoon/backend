import { makeRouter } from "./koaWrapper.js";
import { rebuildSite } from "./rebuildSite.js";

export const router = makeRouter();

router.get("/webhooks/rebuildSite2f997c6", async (ctx) => {
  let result = await rebuildSite();
  ctx.body = result;
});

router.put("/webhooks/crashReport", async (ctx) => {
  ctx.alog.log("crashReport", ctx.request.headers, ctx.request.body);
  ctx.status = 204;
});

router.get("/webhooks/gh-code", async (ctx) => {
  ctx.alog.log("gh-code", ctx.request.headers, ctx.request.body);
  ctx.status = 204;
});
