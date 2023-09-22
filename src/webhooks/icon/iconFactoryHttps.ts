import axios from "axios";
import { Icon, IconDescriptor, ZIcon } from "./icon.js";
import { ApiError } from "../../errors.js";
import { log } from "../../logger.js";
import { recolor } from "./recolor.js";

// in this case the specifier is the url itself
export async function getIcon(
  descriptor: IconDescriptor,
  _prefix: string,
  _subspecifier: string,
): Promise<Icon> {
  const { specifier: url, color } = descriptor;  
  log(`fetching: ${url}`);
  
  const response = await axios.get(url, { responseType: "arraybuffer" });
  const contentType: unknown = response.headers["content-type"];
  if (typeof contentType !== "string") {
    throw new ApiError(500, "Missing content type from remote server");
  }

  const icon: Icon = ZIcon.parse({
    data: response.data,
    contentType,
    colorMode: "mask"
  });
  return color ? recolor(icon, color) : icon;
}
