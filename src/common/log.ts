// stubbed out for now
import "colors";
// biome-ignore lint/suspicious/noExplicitAny: mapping to underlying call
export function log(...args: any[]) {
  console.log(...args);
}
// biome-ignore lint/suspicious/noExplicitAny: mapping to underlying call
export function loge(...args: any[]) {
  console.log("ERROR".white.bgRed, ...args);
}
// biome-ignore lint/suspicious/noExplicitAny: mapping to underlying call
export function logw(...args: any[]) {
  console.log("WARNING".yellow, ...args);
}
