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

export const router = new Router();

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
  ctx.set(
    "Location",
    await generate(canonicalize(ZIconDescriptor.parse(ctx.request.body))),
  );
  ctx.status = 201;
});
