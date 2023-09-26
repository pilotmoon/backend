import { Icon, IconDescriptor } from "./icon.js";
import { ApiError } from "../../errors.js";
import { getIconHttp as getIconHttp } from "./geticonHttp.js";
import { config } from "../config.js";

export async function getIconPopClip(
  descriptor: IconDescriptor,
): Promise<Icon> {
  if (!config.HMA_ROOT) {
    throw new ApiError(500, "HMA_ROOT is not configured");
  }
  //const root = config.HMA_ROOT;
  const root = "http://127.0.0.1:58906";
  const icon = await getIconHttp(descriptor, {
    url: root + "/icon",
    method: "post",
    intrinsicColorPredicate: (response) => {
      return response.headers["x-icon-color-mode"] === "intrinsic";
    },
  });
  return icon;
}
