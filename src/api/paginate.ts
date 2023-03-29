import { Collection, Document } from "mongodb";

export type Pagination = {
  offset: number;
  limit: number;
  order: 1 | -1;
  orderBy: "created";
  startAfter?: string;
};

const maxTime = 8640000000000000;
const distantFuture = new Date(maxTime);
const distantPast = new Date(-maxTime);

export async function paginate<T extends Document>(
  collection: Collection<T>,
  pagination: Pagination,
) {
  const lastDocumentId = pagination.startAfter ?? "";

  const pipeline = [
    {
      $match: {
        created: {
          $lt: distantFuture,
        },
      },
    },
    {
      $sort: {
        created: -1,
      },
    },
    {
      $skip: pagination.offset,
    },
    {
      $limit: pagination.limit,
    },
  ];

  return await collection.aggregate(pipeline).toArray();
}
