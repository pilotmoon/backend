import Router from "@koa/router";
import { getIcon } from "./iconController.js";
import {
  canonicalize,
  generateKey,
  IconDescriptor,
  ZIconDescriptor,
} from "./iconKey.js";
import { LRUCache } from "lru-cache";
import { Icon } from "./handler.js";
import { log } from "console";
import { exists, upload } from "./s3.js";

export const router = new Router();
const cache = new LRUCache<string, Icon>({ max: 1000 });

async function generate(descriptor: IconDescriptor): Promise<string> {
  const { opaque, raw } = generateKey(descriptor);
  log("key: " + opaque);
  const icon = await getIcon(descriptor.specifier, descriptor.color);
  const path = "icons/" + opaque;
  const location = await upload(path, icon.data, icon.contentType, {
    "icon-raw-key": encodeURI(raw),
  });
  return location;
}

router.post(`/frontend/icon`, async (ctx) => {
  const descriptor = canonicalize(
    ZIconDescriptor.parse(ctx.request.body),
  );
  ctx.set("Location", await generate(descriptor));
  ctx.status = 302;
});

router.get(`/frontend/icon/:specifier`, async (ctx) => {
  const descriptor = canonicalize(ZIconDescriptor.parse({
    specifier: ctx.params.specifier,
    color: ctx.query.color,
  }));
  const { opaque } = generateKey(descriptor);
  log("key: " + opaque);

  // get header from spaces to see if it exists
  // if it does, return 302
  let location = await exists("icons/" + opaque);
  if (!location) {
    location = await generate(descriptor);
  }
  ctx.set("Location", location);
  ctx.status = 302;
});
