"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rolo = void 0;
const axios_1 = require("axios");
let roloInstance;
function rolo() {
  if (!roloInstance) {
    roloInstance = axios_1.default.create({
      baseURL: `http://localhost:${process.env.APP_PORT}/v1/`,
      headers: { "X-Api-Key": "dummy" },
      validateStatus: () => true, //
    });
  }
  return roloInstance;
}
exports.rolo = rolo;
