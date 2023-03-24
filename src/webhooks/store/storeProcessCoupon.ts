import { z } from "zod";
import { ApiError } from "../../errors.js";
import { ZSaneString } from "../../saneString.js";

const paddleCatalog = {
  popclip: {
    mode: "live",
    productId: "818494",
  },
  example: {
    mode: "test",
    productId: "47023",
  },
};

const couponPrefix: Record<string, { prefix: string }> = {
  "Student App Centre": {
    prefix: "STU",
  },
  "Student App Centre - test": {
    prefix: "TST",
  },
  "internal test": {
    prefix: "TST",
  },
};

const coupons = {
  "popclip30": {
    product: paddleCatalog.popclip,
    discountPercent: 30,
  },
  "example30": {
    product: paddleCatalog.example,
    discountPercent: 30,
  },
};

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
  const couponPrefixForOrigin = couponPrefix[origin]?.prefix;
  if (!couponPrefixForOrigin) {
    throw new ApiError(403, `Not allowed for origin '${origin}'`);
  }

  // create coupon code
  return "FOO";
}
