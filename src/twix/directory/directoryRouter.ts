import Router from "@koa/router";
import Koa from "koa";
import { z } from "zod";
import { ApiError } from "../../common/errors.js";
import { log } from "../../common/log.js";
import { getRemoteConfig } from "../remoteConfig.js";
import axios, { AxiosInstance } from "axios";

export const router = new Router();

let github: AxiosInstance;
// load credentials from remote config and set up the github client
export async function init() {
  const { accessToken } = z
    .object({ accessToken: z.string() })
    .parse(await getRemoteConfig("github_api"));
  github = axios.create({
    baseURL: "https://api.github.com",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
}

// in case the body was posted as x-www-form-urlencoded, unwrap it
router.post("/webhooks/gh", async (ctx, next) => {
  if (
    ctx.request.headers["content-type"] === "application/x-www-form-urlencoded"
  ) {
    log("Unwrapping github webhook");
    const formBody = z
      .object({ payload: z.string() })
      .safeParse(ctx.request.body);
    if (formBody.success) {
      ctx.request.body = JSON.parse(formBody.data.payload);
    }
  }
  await next();
});

// handle github webhooks
router.post("/webhooks/gh", async (ctx) => {
  console.log("GOT A WEBHOOK!", ctx.request.body);
});
