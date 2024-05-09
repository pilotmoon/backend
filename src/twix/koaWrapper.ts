import Router from "@koa/router";
import Koa from "koa";
import { ActivityLog } from "./activityLog";

export interface TwixState extends Koa.DefaultState {}

export interface TwixContext extends Koa.DefaultContext {
  alog: ActivityLog;
  timestamp: Date;
}

export function makeServer() {
  return new Koa<TwixState, TwixContext>({ proxy: true });
}

export function makeRouter(opt?: Router.RouterOptions) {
  return new Router<TwixState, TwixContext>(opt);
}
