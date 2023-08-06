import axios from "axios";
import { Icon, IconFactory } from "./handler";
import { ApiError } from "../../errors.js";
import { log } from "../../logger.js";

const filenameRegex = /^([^.]+)(?:.png|.svg)$/;

export async function getIcon(
  specifier: string,
): Promise<Icon> {
  if (!filenameRegex.test(specifier)) {
    throw new ApiError(404, "Invalid file name");
  }

  const url = `https://pilotmoon.com/popclip/extensions/icon/${specifier}`;
  log(`fetching: ${url}`);

  const response = await axios.get(url, { responseType: "arraybuffer" });
  const contentType: unknown = response.headers["content-type"];
  if (typeof contentType !== "string") {
    throw new ApiError(500, "Invalid content type");
  }
  return { data: response.data, contentType };
}
