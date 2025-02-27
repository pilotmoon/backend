import { z } from "zod";
import { ApiError } from "../../common/errors.js";
import { log } from "../../common/log.js";
import { getRolo } from "../rolo.js";
import type { AxiosInstance } from "axios";
import _ from "lodash";

export function getLicense(flowId: string, mode: "test" | "live") {
  log("Getting license:", { flowId, mode });
  return lookupLicense(flowId, getRolo(mode));
}

const ZLicenseLookupResponse = z.object({
  object: z.literal("list"),
  items: z.array(
    z
      .object({
        id: z.string(),
        originData: z.object({
          passthrough_data: z.object({
            flow_id: z.string().min(24),
          }),
        }),
      })
      .passthrough(),
  ),
});

async function lookupLicense(flowId: string, api: AxiosInstance) {
  const { data } = await api.get(`/licenseKeys?flowId=${flowId}`);
  const response = ZLicenseLookupResponse.parse(data);
  const orders = response.items.filter(
    (item) => item.originData.passthrough_data.flow_id === flowId,
  );
  if (orders.length === 0) {
    throw new ApiError(404, "Not found");
  }
  if (orders.length > 1) {
    throw new ApiError(500, `Multiple licenses found for flowId: ${flowId}`);
  }
  const result = _.omit(orders[0], "originData");
  result.flowId = flowId;
  log({ result });
  return result;
}
