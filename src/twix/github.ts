import { GraphQLClient, gql } from "graphql-request";
import IPCIDR from "ip-cidr";
import Koa from "koa";
import { z } from "zod";
import { ApiError } from "../common/errors.js";
import { log } from "../common/log.js";
import { getRemoteConfig } from "./remoteConfig.js";
// import axios, { AxiosInstance } from "axios";

// let githubRest: AxiosInstance;
let githubGql: GraphQLClient;
let githubCidrs: IPCIDR[];

export function client() {
  return githubGql;
}

// load credentials from remote config and set up the github client
export async function init() {
  const { accessToken } = z
    .object({ accessToken: z.string() })
    .parse(await getRemoteConfig("github_api"));

  // githubRest = axios.create({
  //   baseURL: "https://api.github.com",
  //   headers: {
  //     Authorization: `Bearer ${accessToken}`,
  //     "X-GitHub-Api-Version": "2022-11-28",
  //   },
  // });

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
    .parse(await client().request(document));
  log("github meta", meta);
  githubCidrs = meta.hookIpAddresses.map((ip: string) => new IPCIDR(ip));
}

// middleware to verify that the request came from github
export async function validateGithubWebhook(ctx: Koa.Context, next: Koa.Next) {
  // check the source ip
  const ip = ctx.request.ip;
  if (!githubCidrs.some((cidr) => cidr.contains(ip))) {
    throw new ApiError(403, `Not from github: ${ip}`);
  }

  // check the event type
  if (ctx.request.headers["x-github-event"] !== "create") {
    throw new ApiError(400, "Invalid github event");
  }

  // unwrap form data if necessary
  if (
    ctx.request.headers["content-type"] === "application/x-www-form-urlencoded"
  ) {
    const formBody = z
      .object({ payload: z.string() })
      .safeParse(ctx.request.body);
    if (formBody.success) {
      ctx.request.body = JSON.parse(formBody.data.payload);
    }
  }

  await next();
}
