/*
Wrap Koa's types to inject our own state type.
*/
import Koa = require("koa");
import Router = require("@koa/router");
import { AuthContext } from "./authController";

interface State {
  auth: AuthContext;
  apiKeyId: string;
  error?: any;
}

export function makeServer() {
  return new Koa<State>({ proxy: true });
}

export function makeRouter(opt?: Router.RouterOptions) {
  return new Router<State>(opt);
}
