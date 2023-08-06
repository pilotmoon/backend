import Router from "@koa/router";
import { getIcon } from "./iconController.js";
import { canonicalize, generateKey, ZIconDescriptor } from "./key.js";
import { LRUCache } from "lru-cache";
import { Icon } from "./handler.js";
import { log } from "console";

export const router = new Router();
const cache = new LRUCache<string, Icon>({ max: 1000 });

router.post(`/frontend/icon`, async (ctx) => {
  const { specifier, color } = canonicalize(
    ZIconDescriptor.parse(ctx.request.body),
  );
  const icon = getIcon(specifier, color);
  ctx.body = icon;
  ctx.status = 201;
  ctx.set("Location", "/icons/" + "x");
});

router.get(`/frontend/icon/:specifier`, async (ctx) => {
  const descriptor = canonicalize(ZIconDescriptor.parse({
    specifier: ctx.params.specifier,
    color: ctx.query.color,
  }));
  const key = generateKey(descriptor);
  log("key: " + key);
  const cachedIcon = cache.get(key);
  if (cachedIcon) {
    ctx.body = cachedIcon.data;
    ctx.set("Content-Type", cachedIcon.contentType);
    return;
  }
  const icon = await getIcon(descriptor.specifier, descriptor.color);
  cache.set(key, icon);
  ctx.body = icon.data;
  ctx.set("Content-Type", icon.contentType);
});
