import Koa from "koa";
import { ActivityLog } from "../activityLog.js";
import { config } from "../config.js";

const ROLO_AUTH_KIND = "live";
const ROLO_DISPLAY_URL = config.ROLO_URL_CANONICAL;

// middleware to open a remote log and make it available to the context
export async function openRemoteLog(ctx: Koa.Context, next: Koa.Next) {
  if (ctx.request.url === "/") {
    // don't open a log for the root page
    return await next();
  }
  ctx.alog = new ActivityLog(ROLO_AUTH_KIND);
  const url = await ctx.alog.prepareRemote(
    `${ctx.request.method} ${ctx.request.url}`,
  );
  if (url) {
    ctx.alog.log(
      `-=-\nRemote log:\n${ROLO_DISPLAY_URL}${url}&format=text\n-=-`,
    );
  } else {
    ctx.alog.log("Failed to create remote log");
  }
  await next();
  ctx.alog.log(`-=-\nResponse status: ${ctx.response.status}\n-=-`);
}
