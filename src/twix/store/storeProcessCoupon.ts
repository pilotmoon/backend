import { z } from "zod";
import { ApiError } from "../../common/errors.js";
import { getPaddleVendorsApi } from "../paddle.js";
import { couponOffers } from "./catalog.js";
import { log } from "../../common/log.js";

const ZCouponArgs = z.object({
  offer: z.enum(Object.keys(couponOffers) as [keyof typeof couponOffers]),
});

export async function processCoupon(
  args: unknown,
  origin: string,
  mode: "test" | "live",
) {
  // create coupon
  log("mode: ", mode);

  const couponArgs = ZCouponArgs.parse(args);
  const offer = couponOffers[couponArgs.offer];

  // check coupon is in correct mode
  if (offer.product?.mode !== mode) {
    throw new ApiError(
      400,
      `'${couponArgs.offer}' only allowed in ${offer.product?.mode} mode`,
    );
  }

  // get the api endpoint
  const paddle = getPaddleVendorsApi(mode);

  // calculate date 28 days from now
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + 28);

  // create coupon
  const { data } = await paddle.post("2.1/product/create_coupon", {
    product_ids: offer.product.productIds.join(","),
    description: `${couponArgs.offer} for ${origin}`,
    coupon_type: "product",
    discount_type: "percentage",
    discount_amount: offer.discountPercent,
    coupon_prefix: offer.prefix,
    num_coupons: 1,
    allowed_uses: 1,
    expires: expiryDate.toISOString().slice(0, 10),
    group: origin,
  });
  log(data);
  return data.response.coupon_codes[0];
}
