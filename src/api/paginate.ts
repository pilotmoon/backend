import { Collection, Document } from "mongodb";

export type Pagination = {
  offset: number;
  limit: number;
  order: 1 | -1;
  orderBy: "created";
  startDate: Date;
  endBeforeDate: Date;
  startCursor?: string;
};

const maxTime = 8640000000000000;
export const distantFuture = new Date(maxTime);
export const distantPast = new Date(-maxTime);

export async function paginate<T extends Document>(
  collection: Collection<T>,
  pagination: Pagination,
  match: Record<string, unknown> = {},
) {
  const lastDocumentId = pagination.startCursor ?? "";
  const pipeline = [
    {
      $match: {
        ...match,
        created: {
          $gte: pagination.startDate,
          $lt: pagination.endBeforeDate,
        },
      },
    },
    {
      $sort: {
        created: pagination.order,
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
