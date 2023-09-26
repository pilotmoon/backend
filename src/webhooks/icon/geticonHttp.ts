import axios, { AxiosResponse } from "axios";
import { Icon, IconDescriptor, ZIcon } from "./icon.js";
import { ApiError } from "../../errors.js";
import { parse as parseContentType } from "content-type";

export async function getIconHttp(
  descriptor: IconDescriptor,
  options?: {
    url?: string;
    method?: "get" | "post";
    intrinsicColorPredicate?: (response: AxiosResponse<ArrayBuffer>) => boolean;
    postprocess?: (icon: Icon, descriptor: IconDescriptor) => Promise<Icon>;
  },
): Promise<Icon> {
  console.time("getIconHttp");
  const url = options?.url ?? descriptor.specifier;
  const method = options?.method ?? "get";
  console.log(`${method} ${url}`);
  const response = await axios<ArrayBuffer>({
    method,
    url,
    responseType: "arraybuffer",
    data: method === "post" ? descriptor : undefined,
  });
  const { data, headers, status } = response;

  // check status
  console.log("status", status);
  if (status !== 200) {
    throw new ApiError(
      status === 404 ? 404 : 503,
      "Remote server returned status " + status + " for " + url,
    );
  }

  // check content type
  const { type: contentType } = parseContentType(headers["content-type"]);
  console.log("contentType", contentType);
  if (typeof contentType !== "string") {
    throw new ApiError(503, "Missing content type from remote server");
  }

  // calculate color mode
  let colorMode = options?.intrinsicColorPredicate?.(response)
    ? "intrinsic"
    : "mask";
  console.log("colorMode", colorMode);

  // parse icon
  let icon: Icon = ZIcon.parse({ data, contentType, colorMode });

  // postprocess
  if (options?.postprocess) {
    console.time("postprocess");
    icon = await options.postprocess(icon, descriptor);
    console.timeEnd("postprocess");
  }
  console.timeEnd("getIconHttp");
  return icon;
}
