/*
Wrap Koa's Router to inject our own AppState type.
*/
import Koa = require("koa");
import Router = require("@koa/router");
import { AuthContext } from "./auth";

interface State {
  auth: AuthContext;
  apiKeyId: string;
}

export function makeServer() {
  return new Koa<State>();
}

export function makeRouter(opt?: Router.RouterOptions) {
  return new Router<State>(opt);
}
