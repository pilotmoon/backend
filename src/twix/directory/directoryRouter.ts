import Router from "@koa/router";
import { configFromText } from "@pilotmoon/fudge";

export const router = new Router();

router.get("/webhooks/gh", async (ctx) => {
  const text = `
#popclip
name: test
url: https://www.google.com/search?q={query}
`;
  ctx.body = configFromText(text);
});
