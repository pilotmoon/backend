// TODO fix this. it doesn't work for chinese characters
// sanitize a name for use in a license file name
export function sanitizeName(name: string, fallback = "") {
  let result = name.replace(/[^\p{L}\p{N}-]/ug, "_");
  // then replace multiple underscores with a single underscore
  result = result.replace(/_+/g, "_");
  // then trim leading and trailing underscores
  result = result.replace(/^_+|_+$/g, "");
  if (!result) result = fallback;
  return result;
}
