import Router from "@koa/router";
import {
  generateIcon,
  IconDescriptor,
  parseIconDescriptor,
} from "./iconGenerator.js";
import { upload } from "./s3.js";
import { Icon } from "./handler.js";
import { kebabCase } from "case-anything";

export const router = new Router();

function meta(icon: Icon, descriptor: IconDescriptor) {
  const meta: Record<string, string> = {};  
  for (const [k, v] of Object.entries(descriptor)) {
    meta[`icon-${kebabCase(k)}`] = encodeURI(String(v));
  }
  if (icon.intrinsicPreserveColor) {
    meta["icon-preserve-color"] = "true";
  }
  console.log(meta);
  return meta;
}

async function store(
  icon: Icon,
  descriptor: IconDescriptor,
  key: string,
): Promise<string> {
  let path = "icontest3/" + key;
  const location = await upload(
    path,
    icon.data,
    icon.contentType,
    meta(icon, descriptor),
  );
  console.log("Stored icon at", location);
  return location;
}

async function storeAll(descriptor: IconDescriptor) {
  await Promise.all(
    ([undefined, null, "#000000", "#ffffff", "#4d4d4d", "#b2b2b2"] as const).map(
      async (color) => {
        const altered: IconDescriptor = { ...descriptor }        
        if (color) {
          altered.color = color;
        } else if (color === null){ 
          delete altered.color;
        }        
        const { icon, key } = await generateIcon(altered);
        return store(icon, altered, key);
      },
    ),
  );
}

// generate the icon and return the icon data; meanwhile, store the icon in S3
// in the background in original, black, and white colors
router.post(`/frontend/icon`, async (ctx) => {
  const descriptor = parseIconDescriptor(ctx.request.body);
  const { icon, key } = await generateIcon(descriptor);
  storeAll(descriptor).then(() => console.log("Stored all icons"));
  ctx.body = icon.data;
  ctx.type = icon.contentType;
  ctx.set("x-icon-key", key);
});
