import Router from "@koa/router";
import { ApiError } from "../../errors.js";
import { config } from "../config.js";
import { log } from "../../logger.js";
import axios from "axios";
export const router = new Router();

const filenameRegex = /[^\.\/]+(?:\.png|\.svg)/;

// proxying to the icons on the legacy server
router.get(`/frontend/img/pcx/:filename(${filenameRegex.source})`, async (ctx) => {
  //const tint = ctx.query['hexcolor'];
  const filename = ctx.params.filename;
  log(`filename: ${filename}`);

  // pull from server with axios
  const url = `https://pilotmoon.com/popclip/extensions/icon/${filename}`;
  log(`url: ${url}`);
  const response = await axios.get(url, { responseType: "arraybuffer" });
  ctx.body = response.data;
  ctx.set("Content-Type", response.headers["content-type"]);
});
