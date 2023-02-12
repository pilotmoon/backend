// stubbed out for now
import "colors";
export function log(...args: any[]) {
  console.log(...args);
}
export function loge(...args: any[]) {
  console.log("ERROR".bgRed, ...args);
}
export function logw(...args: any[]) {
  console.log("WARNING".yellow, ...args);
}
