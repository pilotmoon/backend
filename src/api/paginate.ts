import { Collection, Document } from "mongodb";
import { log } from "../logger.js";

export type Pagination = {
  offset: number;
  limit: number;
  order: 1 | -1;
  orderBy: "created";
  gteDate: Date;
  ltDate: Date;
  cursor?: string;
};

const maxTime = 8640000000000000;
export const distantFuture = new Date(maxTime);
export const distantPast = new Date(-maxTime);

// This function is used to search a collection with pagination and date filtering.
// Ordering is done by the date field (created) and then by _id in case of equal dates.
// The cursor is used to filter out documents that are before or after the cursor
// (depending on the order).
export async function paginate<T extends Document>(
  collection: Collection<T>,
  pagination: Pagination,
  match: Record<string, unknown> = {},
) {
  // standard aggregation pipeline with no cursor
  const pipeline: Document[] = [
    {
      $match: {
        ...match,
        created: {
          $gte: pagination.gteDate,
          $lt: pagination.ltDate,
        },
      },
    },
  ];

  // add cursor filtering to the pipeline
  if (pagination.cursor) {
    const direction = pagination.order === 1 ? "$gt" : "$lt";
    pipeline.push({
      // the lookup stage finds documents matching the cursor id
      // and adds the result the cursorDoc field in every document
      $lookup: {
        from: collection.collectionName,
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: ["$_id", pagination.cursor],
              },
            },
          },
          {
            $project: { _id: 0, created: 1 },
          },
        ],
        as: "cursorDoc",
      },
    }, {
      // the unwind stage removes the array around the cursorDoc field
      $unwind: {
        path: "$cursorDoc",
      },
    }, {
      // the addFields stage adds a boolean field to every document
      // that is true if the document is after the cursor
      $addFields: {
        afterCursor: {
          $cond: [
            {
              [direction]: ["$created", "$cursorDoc.created"],
            },
            true,
            {
              $and: [
                { $eq: ["$created", "$cursorDoc.created"] },
                { [direction]: ["$_id", pagination.cursor] },
              ],
            },
          ],
        },
      },
    }, {
      // the final match stage filters out documents that are before the cursor
      $match: {
        afterCursor: true,
      },
    });
  }

  return await collection.aggregate(pipeline)
    .sort({ created: pagination.order, _id: pagination.order })
    .skip(pagination.offset)
    .limit(pagination.limit)
    .toArray();
}
