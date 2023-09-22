import axios from "axios";
import { Icon, HexColor } from "./handler";
import { ApiError } from "../../errors.js";
import { log } from "../../logger.js";
import { recolor } from "./recolor.js";

// in this case the specifier is the url itself
export async function getIcon(
  prefix: string,
  subspecifier: string,
  color?: HexColor
): Promise<Icon> {
  const url = prefix + ":" + subspecifier;
  log(`fetching: ${url}`);

  const response = await axios.get(url, { responseType: "arraybuffer" });
  const contentType: unknown = response.headers["content-type"];
  if (typeof contentType !== "string") {
    throw new ApiError(500, "Missing content type from remote server");
  }
  
  const icon: Icon = { data: response.data, contentType, intrinsicPreserveColor: false }; 
  return color ? recolor(icon, color) : icon;
}
