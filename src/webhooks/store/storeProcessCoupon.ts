import { z } from "zod";
import { ApiError } from "../../errors.js";
import { getPaddle } from "../paddle.js";
import { couponPrefixes, coupons } from "./coupons.js";

const ZCouponArgs = z.object({
  coupon_id: z.enum(Object.keys(coupons) as [keyof typeof coupons]),
});

export async function processCoupon(
  args: unknown,
  origin: string,
  mode: "test" | "live",
) {
  // create coupon
  console.log("mode: ", mode);

  const couponArgs = ZCouponArgs.parse(args);
  const coupon = coupons[couponArgs.coupon_id];

  // check coupon is in correct mode
  if (coupon.product.mode !== mode) {
    throw new ApiError(
      400,
      `'${couponArgs.coupon_id}' only allowed in ${coupon.product.mode} mode`,
    );
  }

  // check we have a coupon prefix for this origin
  const couponPrefix = couponPrefixes[origin]?.prefix;
  if (!couponPrefix) {
    throw new ApiError(403, `Not allowed for origin '${origin}'`);
  }

  // get the api endpoint
  const paddle = getPaddle(mode);

  // calculate date 28 days from now
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + 28);

  // create coupon
  const { data } = await paddle.post("2.1/product/create_coupon", {
    product_ids: coupon.product.productIds.join(","),
    description: `${couponArgs.coupon_id} for ${origin}`,
    coupon_type: "product",
    discount_type: "percentage",
    discount_amount: coupon.discountPercent,
    coupon_prefix: couponPrefix,
    num_coupons: 1,
    allowed_uses: 1,
    expires: expiryDate.toISOString().slice(0, 10),
    group: origin,
  });
  console.log(data);
  return data.response.coupon_codes[0];
}
