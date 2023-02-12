"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loge = exports.log = void 0;
// stubbed out for now
function log(...args) {
  console.log(...args);
}
exports.log = log;
function loge(...args) {
  console.log("ERROR".bgRed, ...args);
}
exports.loge = loge;
