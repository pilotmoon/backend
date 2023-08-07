import Router from "@koa/router";
import { getIcon } from "./iconController.js";
import {
  canonicalize,
  generateKey,
  IconDescriptor,
  ZIconDescriptor,
} from "./iconKey.js";
import { log } from "console";
import { upload } from "./s3.js";
import { Icon } from "./handler.js";

export const router = new Router();

async function generate(descriptor: IconDescriptor): Promise<Icon> {
  return await getIcon(descriptor.specifier, descriptor.color);
}

async function store(icon: Icon, descriptor: IconDescriptor): Promise<string> {
  const { opaque, raw } = generateKey(descriptor);
  const path = "icons/" + opaque;
  const location = await upload(path, icon.data, icon.contentType, {
    "icon-raw-key": encodeURI(raw),
  });
  return location;
}

// generate icon and store it, returning the location
router.post(`/frontend/icon`, async (ctx) => {
  const descriptor = canonicalize(ZIconDescriptor.parse(ctx.request.body));
  const icon = await generate(descriptor);
  const location = await store(icon, descriptor);
  ctx.set("Location", location);
  ctx.status = 201;
});
