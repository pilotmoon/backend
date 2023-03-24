import { z } from "zod";
import { ZLicenseExternal } from "../../licenseFileObject.js";
import { ZSaneString } from "../../saneString.js";
import { getApi } from "../getApi.js";

const ZLizhiArgs = z.object({
  name: ZSaneString,
  email: ZSaneString,
  order: ZSaneString,
  product: ZSaneString,
  quantity: z.number().optional(),
});

export async function processLicense(
  args: unknown,
  origin: string,
  mode: "test" | "live",
) {
  // create license
  console.log("mode: ", mode);
  const lizhiArgs = ZLizhiArgs.parse(args);
  const api = getApi(mode);
  const info = {
    email: lizhiArgs.email,
    name: lizhiArgs.name,
    product: lizhiArgs.product,
    quantity: lizhiArgs.quantity ?? 1,
    order: lizhiArgs.order,
    origin,
  };
  const { data } = await api.post("/licenseKeys", info);
  return ZLicenseExternal.parse(data);
}
