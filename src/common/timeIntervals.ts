// simple time interval functions
export function seconds(n: number) {
  return 1000 * n;
}
export function minutes(n: number) {
  return seconds(60) * n;
}
export function hours(n: number) {
  return minutes(60) * n;
}
export function days(n: number) {
  return hours(24) * n;
}
