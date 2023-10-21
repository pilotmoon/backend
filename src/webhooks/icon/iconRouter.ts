import Router from "@koa/router";
import { getIcon } from "./iconFactory.js";
import { upload } from "./s3.js";
import { Icon, IconDescriptor, parseIconDescriptor } from "./icon.js";
import { kebabCase } from "case-anything";

export const router = new Router();

function meta(icon: Icon, descriptor: IconDescriptor) {
  const meta: Record<string, string> = {};
  for (const [k, v] of Object.entries(descriptor)) {
    meta[`icon-${kebabCase(k)}`] = encodeURI(String(v));
  }
  meta["icon-color-mode"] = icon.colorMode;
  console.log(meta);
  return meta;
}

async function store(
  icon: Icon,
  descriptor: IconDescriptor,
  key: string,
): Promise<void> {
  await upload(
    "icon/id-test-b/" + key,
    icon.data,
    icon.contentType,
    meta(icon, descriptor),
  );
}

// generate the icon and return the icon data; meanwhile, store the icon in S3
// in the background in original, black, and white colors
router.get(`/frontend/icon`, async (ctx) => {
  const descriptor = parseIconDescriptor(ctx.query);
  const { icon, key } = await getIcon(descriptor);
  store(icon, descriptor, key);

  ctx.body = icon.data;
  ctx.type = icon.contentType;
  ctx.set("X-Icon-Key", key);
  ctx.set("Cache-Control", "public, s-maxage=2592000, max-age=3600, immutable");
});
