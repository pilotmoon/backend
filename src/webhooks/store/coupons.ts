const paddleCatalog = {
  popclip: {
    live: {
      productIds: ["818494"],
    },
    test: {
      productIds: ["41687"],
    },
  },
  example: {
    live: {
      productIds: ["818704"],
    },
    test: {
      productIds: ["47023"],
    },
  },
};
export const couponPrefixes: Record<string, { prefix: string }> = {
  "Student App Centre": {
    prefix: "STU",
  },
  "Student App Centre - test": {
    prefix: "STT",
  },
  "internal test": {
    prefix: "TST",
  },
};
export const couponOffers = {
  "popclip30": {
    product: paddleCatalog.popclip,
    discountPercent: 30,
  },
  "example30": {
    product: paddleCatalog.example,
    discountPercent: 30,
  },
};
