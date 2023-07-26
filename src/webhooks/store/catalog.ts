interface Catalog {
  [key: string]: {
    mode: "live" | "test",
    productIds: string[]
  } | undefined
}
export const paddleCatalog: Catalog = {
  popclip: {
    mode: "live",
    productIds: ["818494"],
  },
  example: {
    mode: "test",
    productIds: ["47023"],
  },
};
export const couponOffers = {
  "popclip30": {
    product: paddleCatalog.popclip,
    discountPercent: 30,
    prefix: "STU",
  },
  "example30": {
    product: paddleCatalog.example,
    discountPercent: 30,
    prefix: "TST",
  },
};
