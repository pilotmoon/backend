import Router from "@koa/router";
import { getIcon } from "./getIcon.js";
import { parseDescriptor } from "./iconDescriptor.js";
import { log } from "../../logger.js";

export const router = new Router();

// retrieve the icon for the given descriptor
router.get(`/frontend/icon`, async (ctx) => {
  const descriptor = parseDescriptor(ctx.query);
  const icon = await getIcon(descriptor);
  log("icondata", icon.data);
  ctx.body = Buffer.from(icon.data);
  ctx.type = icon.contentType;
  ctx.set("Cache-Control", "public, max-age=604800, s-maxage=604800, stale-while-revalidate=604800");
  ctx.set("X-Icon-Color-Mode", icon.colorMode);
});
