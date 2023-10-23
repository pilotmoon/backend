import { Icon } from "./iconFactory.js";
import { IconDescriptor } from "./iconDescriptor.js";
import { ApiError } from "../../errors.js";
import { getIconHttp as getIconHttp } from "./getIconFetch.js";
import { config } from "../config.js";

export async function getIconPopClip(
  descriptor: IconDescriptor,
): Promise<Icon> {
  if (!config.HMA_ROOT) {
    throw new ApiError(500, "HMA_ROOT is not configured");
  }
  const root = config.HMA_ROOT;
  const icon = await getIconHttp(descriptor, {
    url: root + "/icon",
    method: "post",
    intrinsicColorPredicate: async (response) => {
      return response.headers.get("x-icon-color-mode") === "intrinsic";
    },
  });
  return icon;
}
