/*
Wrap Koa's types to inject our own state type.
*/
import Koa = require("koa");
import Router = require("@koa/router");
import { Auth } from "./controllers/authController";
import { PaginateState } from "./middleware/processPagination";

interface State extends Koa.DefaultState {
  // items set by auth midddleware
  auth: Auth;
  apiKeyId: string;

  // items set by paginator middleware
  paginate: PaginateState;
}

interface Context extends Koa.DefaultContext {
  // function to generate Location header
  getLocation(name: string, params?: any): string;
}

export function makeServer() {
  return new Koa<State, Context>({ proxy: true });
}

export function makeRouter(opt?: Router.RouterOptions) {
  return new Router<State, Context>(opt);
}
