import Router from "@koa/router";
import { ApiError } from "../../errors.js";

import { getIcon as getIconPcx } from "./handlerPcx.js";
import { Icon, IconFactory } from "./handler.js";
import { recolor } from "./recolor.js";

import { LRUCache } from 'lru-cache'

const cache = new LRUCache<string, Icon>({max: 1000});

export const router = new Router();

const specifierRegex = /^([0-9a-z]+):(.+)$/;

const handlers: Record<string, IconFactory> = {
  pcx: getIconPcx,
};

// proxying to the icons on the legacy server
router.get(`/frontend/icon/:specifier`, async (ctx) => {
  const match = specifierRegex.exec(ctx.params.specifier);
  if (!match) {
    throw new ApiError(404, "Invalid specifier");
  }
  const [, prefix, subspecifier] = match;
  const handler = handlers[prefix];
  if (!handler) {
    throw new ApiError(404, "Unknown prefix: " + prefix);
  }

  let hexColor: string = "000000";
  const hexColorRegex = /^([0-9a-f]{3}|[0-9a-f]{6})$/;
  if (typeof ctx.query.color === "string") {
    if (hexColorRegex.test(ctx.query.color)) {
      hexColor = ctx.query.color;
    } else {
      throw new ApiError(400, "Invalid color specified");
    }
  }

  const cacheKey = `${prefix}:${subspecifier}!${hexColor}`;
  const cachedIcon = cache.get(cacheKey);
  if (cachedIcon) {
    console.log("Using cached icon for", cacheKey);
    ctx.body = cachedIcon.data;
    ctx.set("Content-Type", cachedIcon.contentType);
    return;
  }
  console.log("getIcon", prefix, subspecifier, hexColor);
  const icon = await recolor(await handler(subspecifier), hexColor);
  cache.set(cacheKey, icon);
  ctx.body = icon.data;
  ctx.set("Content-Type", icon.contentType);
});
