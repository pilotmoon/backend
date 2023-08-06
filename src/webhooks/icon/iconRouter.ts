import Router from "@koa/router";
import { z } from "zod";
import { getIcon } from "./iconController.js";
import { canonicalizeColor } from "./key.js";
export const router = new Router();

const ZIconDescriptor = z.object({
  specifier: z.string(),
  color: z.string().optional(),
});

router.post(`/frontend/icon`, async (ctx) => {
  const { specifier, color } = ZIconDescriptor.parse(ctx.request.body);
  const icon = getIcon(specifier, color);
  ctx.body = icon;
  ctx.status = 201;
  ctx.set("Location", "/icons/" + "x");
});

router.get(`/frontend/icon/:specifier`, async (ctx) => {
  const { specifier } = ctx.params;
  const { color } = ctx.query;
  const icon = await getIcon(specifier, canonicalizeColor(color));
  ctx.body = icon.data
  ctx.set("Content-Type", icon.contentType);
});



