import { makeRouter } from "./koaWrapper.js";
import { rebuildSite } from "./rebuildSite.js";
import { getRolo } from "./rolo.js";

export const router = makeRouter();

router.get("/webhooks/rebuildSite2f997c6", async (ctx) => {
  let result = await rebuildSite();
  ctx.body = result;
});

router.post("/webhooks/reportCrash", async (ctx) => {
  ctx.alog.log("reportCrash", ctx.request.headers);
  // send as event
  const eventPayload = {
    type: "crashReport",
    timestamp: new Date().toISOString(),
    logUrl: ctx.alog.url,
    payloadType: ctx.get("PopCrashes-Report-Type") || "unknown",
    payloadId: ctx.get("PopCrashes-Report-Id") || "unknown",
    payload: ctx.request.body,
  };
  await getRolo("live").post("/events", eventPayload);
  ctx.status = 204;
});

router.get("/webhooks/gh-code", async (ctx) => {
  ctx.alog.log("gh-code", ctx.request.headers, ctx.request.body);
  ctx.status = 204;
});
