import { z } from "zod";
import { ApiError } from "../../common/errors.js";
import { getPaddleVendorsApi } from "../paddle.js";
import { getCouponOffers } from "./catalog.js";
import { ActivityLog } from "../activityLog.js";

const ZCouponArgs = z.object({
  offer: z.string(),
});

export async function processCoupon(
  alog: ActivityLog,
  args: unknown,
  origin: string,
  mode: "test" | "live",
) {
  // create coupon
  alog.log(`mode: ${mode}`);

  const couponArgs = ZCouponArgs.parse(args);
  const offer = (await getCouponOffers())[couponArgs.offer];
  if (!offer) {
    throw new ApiError(400, `Unknown coupon offer '${couponArgs.offer}'`);
  }

  // check coupon is in correct mode
  if (offer.catalogEntry.mode !== mode) {
    throw new ApiError(
      400,
      `'${couponArgs.offer}' only allowed in ${offer.catalogEntry.mode} mode`,
    );
  }

  // get the api endpoint
  const paddle = await getPaddleVendorsApi(mode);

  // calculate date 28 days from now
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + 28);

  // create coupon
  const { data } = await paddle.post("2.1/product/create_coupon", {
    //product_ids: offer.catalogEntry.productId,
    description: `${couponArgs.offer} for ${origin}`,
    coupon_type: "checkout",
    discount_type: "percentage",
    discount_amount: offer.discountPercent,
    coupon_prefix: offer.prefix,
    num_coupons: 1,
    allowed_uses: 1,
    expires: expiryDate.toISOString().slice(0, 10),
    group: origin,
  });
  alog.log("Response data:", data);
  return data.response.coupon_codes[0];
}
