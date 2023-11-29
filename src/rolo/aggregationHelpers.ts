// helper to convert array of { _id, count } into an object of key-value pairs
export function setObject(key: string, subKey: string) {
  return {
    $set: {
      [key]: {
        $arrayToObject: {
          $map: {
            input: `$${key}`,
            as: "item",
            in: { k: "$$item._id", v: `$$item.${subKey}` },
          },
        },
      },
    },
  };
}
// helper to concatenate array of arrays into a single array
export function concatArrays(key: string) {
  return {
    $set: {
      [key]: {
        $reduce: {
          input: `$${key}`,
          initialValue: [],
          in: { $concatArrays: ["$$value", "$$this"] },
        },
      },
    },
  };
}
