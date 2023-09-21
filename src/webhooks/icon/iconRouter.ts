import Router from "@koa/router";
import {
  generateIcon,
  IconDescriptor,
  parseIconDescriptor,
} from "./iconGenerator.js";
import { upload } from "./s3.js";
import { Icon } from "./handler.js";
import { calculateIconKey } from "./iconKey.js";

export const router = new Router();

function suffix(color?: string) {
  return color ? `-${color.slice(1)}` : "";
}

async function store(
  icon: Icon,
  descriptor: IconDescriptor,
): Promise<string> {
  const key = calculateIconKey(descriptor.specifier);
  let path = 'icontest2/' + key + suffix(descriptor.color);
  const location = await upload(path, icon.data, icon.contentType, {
    "icon-specifier": encodeURI(descriptor.specifier),
  });
  console.log("Stored icon at", location);
  return location;
}

async function storeAll(specifier: string) {   
  await Promise.all(([undefined, "#000000", "#ffffff", "#4d4d4d", "#b2b2b2" ] as const).map(async (color) => {
    const descriptor = { specifier, color };  
    const icon = await generateIcon(descriptor);
    return store(icon, descriptor);
  }));
}

// generate the icon and return the icon data; meanwhile, store the icon in S3
// in the background in original, black, and white colors
router.post(`/frontend/icon`, async (ctx) => {
  const descriptor = parseIconDescriptor(ctx.request.body);
  const { data, contentType } = await generateIcon(descriptor);
  storeAll(descriptor.specifier).then(() => console.log("Stored all icons"));
  ctx.body = data;
  ctx.type = contentType;
});
