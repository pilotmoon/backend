"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const Router = require("@koa/router");
const node_crypto_1 = require("node:crypto");
exports.router = new Router({ prefix: "/licenses" });
const PATH_NAME = (0, node_crypto_1.randomUUID)();
// router.post("/", async (ctx) => {
//   const params = LicenseDetails.parse(ctx.request.body);
//   const document = await createLicense(params, ctx.state.auth);
//   ctx.body = document;
//   ctx.status = 201;
//   ctx.set("Location", ctx.fullUrl(PATH_NAME, { id: document._id }));
// }
