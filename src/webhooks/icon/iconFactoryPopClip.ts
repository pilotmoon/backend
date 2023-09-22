import axios from "axios";
import { Icon, IconDescriptor, ZIcon } from "./icon.js";
import { ApiError } from "../../errors.js";
import { log } from "../../logger.js";
import { config } from "../config.js";

// in this case the specifier is the url itself
export async function getIcon(
  descriptor: IconDescriptor,
  _prefix: string,
  _subspecifier: string,
): Promise<Icon> {
  if (!config.HMA_ROOT) {
    throw new ApiError(500, "HMA_ROOT is not configured");
  }
  //const root = "http://127.0.0.1:58906";
  const root = config.HMA_ROOT;
  const url = root + '/icon'
  log(`posting to from ${url}`);  

  const response = await axios.post(url, descriptor, { responseType: "arraybuffer" });
  console.log(response);
  const contentType: unknown = response.headers["content-type"];
  if (typeof contentType !== "string") {
    throw new ApiError(500, "Missing content type from remote server");
  }
  let colorMode: unknown = response.headers["x-icon-color-mode"]; 
  if (!colorMode) {
    // TODO implement at other end    
    colorMode = "mask";
  }
  const icon: Icon = ZIcon.parse({
    data: response.data,
    contentType,
    colorMode,
  });
  return icon;
}
