import _ from "lodash";
import { Collection, Document } from "mongodb";
import { z } from "zod";
import { log } from "../common/log.js";

export const ZPagination = z.object({
  offset: z.number().int().min(0),
  limit: z.number().int().min(1).max(10000),
  sort: z.literal(1).or(z.literal(-1)),
  sortBy: z.literal("created"),
  cursor: z.string().optional(),
  gteDate: z.coerce.date().optional(),
  ltDate: z.coerce.date().optional(),
});
export type Pagination = z.infer<typeof ZPagination>;

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
  customPipeline?: Document[],
): Promise<Array<T>> {
  const pipeline: Document[] = [];

  // add date filtering if dates are provided
  if (pagination.gteDate || pagination.ltDate) {
    const created = {} as Document;
    if (pagination.gteDate) {
      created.$gte = pagination.gteDate;
    }
    if (pagination.ltDate) {
      created.$lt = pagination.ltDate;
    }
    pipeline.push({ $match: { created } });
  }

  // add custom pipeline if provided
  if (customPipeline) {
    pipeline.push(...customPipeline);
  }

  // add cursor filtering to the pipeline if a cursor is provided
  if (pagination.cursor) {
    pipeline.push(...cursorPipeline(collection, pagination));
  }

  // add sorting and skipping
  // log("paginate", { pipeline, pagination });
  const resultsCursor = collection
    .aggregate(pipeline)
    .sort({ created: pagination.sort, _id: pagination.sort })
    .skip(pagination.offset)
    .limit(pagination.limit);

  return (await resultsCursor.toArray()) as T[];
}

function cursorPipeline<T extends Document>(
  collection: Collection<T>,
  pagination: Pagination,
) {
  const comparison = pagination.sort === 1 ? "$gt" : "$lt";
  return [
    {
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
    },
    {
      // the unwind stage removes the array around the cursorDoc field
      $unwind: {
        path: "$cursorDoc",
      },
    },
    {
      // the set stage adds a boolean field to every document
      // that is true if the document is after the cursor
      $set: {
        afterCursor: {
          $cond: [
            {
              [comparison]: ["$created", "$cursorDoc.created"],
            },
            true,
            {
              $and: [
                { $eq: ["$created", "$cursorDoc.created"] },
                { [comparison]: ["$_id", pagination.cursor] },
              ],
            },
          ],
        },
      },
    },
    {
      // the final match stage filters out documents that are before the cursor
      $match: {
        afterCursor: true,
      },
    },
    {
      // the final project stage removes the cursorDoc and afterCursor fields
      $project: {
        cursorDoc: 0,
        afterCursor: 0,
      },
    },
  ];
}
