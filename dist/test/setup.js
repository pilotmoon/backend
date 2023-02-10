"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rolo = void 0;
const axios_1 = require("axios");
let roloInstance;
function rolo(key = process.env.API_KEY_TEST_GOOD) {
  if (!roloInstance) {
    roloInstance = axios_1.default.create({
      baseURL: `http://localhost:${process.env.APP_PORT}/v1/`,
      headers: { "Authorization": `Bearer ${key}` },
      validateStatus: () => true, //
    });
  }
  return roloInstance;
}
exports.rolo = rolo;
