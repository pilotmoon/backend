import Router from "@koa/router";
import { getIcon } from "./iconController.js";
import { canonicalize, generateKey, ZIconDescriptor } from "./key.js";
import { LRUCache } from "lru-cache";
import { Icon } from "./handler.js";
import { log } from "console";
import { upload } from "./s3.js";

export const router = new Router();
const cache = new LRUCache<string, Icon>({ max: 1000 });

router.post(`/frontend/icon`, async (ctx) => {
  const descriptor = canonicalize(
    ZIconDescriptor.parse(ctx.request.body),
  );
  const { opaque, raw } = generateKey(descriptor);
  log("key: " + opaque);
  const icon = await getIcon(descriptor.specifier, descriptor.color);
  const path = "icons/" + opaque
  const location = await upload(path, icon.data, icon.contentType, {
    "icon-raw-key": encodeURI(raw),
  });
  ctx.status = 201;
  ctx.set("Location", location);
});

router.get(`/frontend/icon/:specifier`, async (ctx) => {
  const descriptor = canonicalize(ZIconDescriptor.parse({
    specifier: ctx.params.specifier,
    color: ctx.query.color,
  }));
  const { opaque } = generateKey(descriptor);
  log("key: " + opaque);
  const cachedIcon = cache.get(opaque);
  if (cachedIcon) {
    ctx.body = cachedIcon.data;
    ctx.set("Content-Type", cachedIcon.contentType);
    return;
  }
  const icon = await getIcon(descriptor.specifier, descriptor.color);
  cache.set(opaque, icon);
  ctx.body = icon.data;
  ctx.set("Content-Type", icon.contentType);
});
