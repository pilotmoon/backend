import { Icon, ZIcon } from "./iconFactory.js";
import { IconDescriptor } from "./iconDescriptor.js";
import { ApiError } from "../../errors.js";
import { parse as parseContentType } from "content-type";

export async function getIconHttp(
  descriptor: IconDescriptor,
  options?: {
    url?: string;
    method?: "get" | "post";
    intrinsicColorPredicate?: (response: Response) => Promise<boolean>;
    postprocess?: (icon: Icon, descriptor: IconDescriptor) => Promise<Icon>;
  },
): Promise<Icon> {
  const url = options?.url ?? descriptor.specifier;
  const method = options?.method ?? "get";
  const response = await fetch(url, {
    method,
    body: method === "post" ? JSON.stringify(descriptor) : undefined,
  });

  // check status
  console.log("status", response.status);
  if (response.status !== 200) {
    throw new ApiError(
      response.status === 404 ? 404 : 503,
      "Remote server returned status " + response.status + " for " + url,
    );
  }

  // check content type
  const { type: contentType } = parseContentType(response.headers.get("content-type") ?? "");
  console.log("contentType", contentType);
  if (typeof contentType !== "string") {
    throw new ApiError(503, "Missing content type from remote server");
  }

  // calculate color mode
  let colorMode = await options?.intrinsicColorPredicate?.(response)
    ? "intrinsic"
    : "mask";
  console.log("colorMode", colorMode);

  if (options?.postprocess) {    
    const icon = ZIcon.parse({ data: await response.arrayBuffer(), contentType, colorMode });
    return await options.postprocess(icon, descriptor);
  } else {
    return ZIcon.parse({ data: response.body, contentType, colorMode });
  }
}
