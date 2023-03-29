/*
Wrap Koa's types to inject our own state type.
*/
import Koa from "koa";
import Router from "@koa/router";
import { Auth } from "./auth.js";
import { Pagination } from "./middleware/processPagination.js";

interface State extends Koa.DefaultState {
  // items set by auth midddleware
  auth: Auth;
  apiKeyId: string;

  // items set by paginator middleware
  pagination: Pagination;
}

interface Context extends Koa.DefaultContext {
  // function to generate a URL for the Location header or other purposes
  // name: name of the route
  // params: parameters to pass to the route
  // query: query parameters to add to the URL
  // full: if true, return a full URL including the app's base URL
  getLocation(name: string, params?: any, query?: {}, full?: boolean): string;
}

export function makeServer() {
  return new Koa<State, Context>({ proxy: true });
}

export function makeRouter(opt?: Router.RouterOptions) {
  return new Router<State, Context>(opt);
}
