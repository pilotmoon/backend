import axios, { AxiosInstance } from "axios";
import { GraphQLClient, gql } from "graphql-request";
import IPCIDR from "ip-cidr";
import Koa from "koa";
import { z } from "zod";
import { ApiError } from "../common/errors.js";
import { log } from "../common/log.js";
import { getRemoteConfig } from "./remoteConfig.js";

let githubRest: AxiosInstance;
let githubGql: GraphQLClient;
let githubCidrs: IPCIDR[];

export function gqlClient() {
  return githubGql;
}

export function restClient() {
  return githubRest;
}

// load credentials from remote config and set up the github client
export async function init() {
  const { accessToken } = z
    .object({ accessToken: z.string() })
    .parse(await getRemoteConfig("github_api"));

  githubRest = axios.create({
    baseURL: "https://api.github.com",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "X-GitHub-Api-Version": "2022-11-28",
      Accept: "application/vnd.github+json",
    },
  });

  githubGql = new GraphQLClient("https://api.github.com/graphql", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

// keep the list of
export async function housekeep() {
  log("housekeeping github router");
  const document = gql`
    {
      meta {
        hookIpAddresses
      }
    }
  `;
  const { meta } = z
    .object({
      meta: z.object({
        hookIpAddresses: z.array(z.string()),
      }),
    })
    .parse(await gqlClient().request(document));
  log("github meta", meta);
  githubCidrs = meta.hookIpAddresses.map((ip: string) => new IPCIDR(ip));
}

// middleware to validate and cook the request from github
export async function validateGithubWebhook(ctx: Koa.Context, next: Koa.Next) {
  // check the source ip
  const ip = ctx.request.ip;
  if (!githubCidrs.some((cidr) => cidr.contains(ip))) {
    throw new ApiError(403, `Not from github: ${ip}`);
  }

  // check the event type
  if (ctx.request.headers["x-github-event"] !== "create") {
    throw new ApiError(
      400,
      `Unsupported github event type: ${ctx.request.headers["x-github-event"]}`,
    );
  }

  // unwrap form data if necessary
  if (
    ctx.request.headers["content-type"] === "application/x-www-form-urlencoded"
  ) {
    const { payload } = z
      .object({ payload: z.string() })
      .parse(ctx.request.body);
    ctx.request.body = JSON.parse(payload);
  }

  await next();
}
