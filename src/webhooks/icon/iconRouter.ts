import Router from "@koa/router";
import { ApiError } from "../../errors.js";

import { getIcon as getIconPcx } from "./handlerPcx.js";
import { IconFactory } from "./handler.js";
import { recolor } from "./recolor.js";
export const router = new Router();

const specifierRegex = /^([0-9a-z]+):(.+)$/;

const handlers: Record<string, IconFactory> = {
  pcx: getIconPcx,
};

// proxying to the icons on the legacy server
router.get(`/frontend/img/:specifier`, async (ctx) => {
  const match = specifierRegex.exec(ctx.params.specifier);
  if (!match) {
    throw new ApiError(404, "Invalid specifier");
  }
  const [, prefix, subspecifier] = match;
  const handler = handlers[prefix];
  if (!handler) {
    throw new ApiError(404, "Unknown prefix: " + prefix);
  }

  let hexColor: string | undefined;
  const hexColorRegex = /^([0-9a-f]{3}|[0-9a-f]{6})$/;
  if (typeof ctx.query.color === "string") {
    if (hexColorRegex.test(ctx.query.color)) {
      hexColor = ctx.query.color;
    } else {
      throw new ApiError(400, "Invalid color specified");
    }
  }
  console.log("getIcon", prefix, subspecifier, hexColor);
  const icon = await recolor(await handler(subspecifier), hexColor);
  ctx.body = icon.data;
  ctx.set("Content-Type", icon.contentType);
});
