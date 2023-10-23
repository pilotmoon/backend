import { Icon } from "./iconFactory.js";
import { IconDescriptor } from "./iconDescriptor.js";
import { ApiError } from "../../errors.js";
import { getIconHttp as getIconHttp } from "./getIconHttp.js";
import { postprocess } from "./postprocess.js";

export async function getIconIconify(
  descriptor: IconDescriptor,
): Promise<Icon> {
  const [_, set, name] = descriptor.specifier.split(":");
  if (set === undefined || name === undefined) {
    throw new ApiError(400, "Invalid iconify specifier");
  }
  const url = `https://api.iconify.design/${set}/${name}.svg`;
  const icon = await getIconHttp(descriptor, {
    url,
    intrinsicColorPredicate: (response) => {
      const svgString = Buffer.from(response.data).toString("utf-8");
      return !svgString.includes('"currentColor"');
    },
    postprocess,
  });
  return icon;
}
