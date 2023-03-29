import { Collection, Document } from "mongodb";

export type Pagination = {
  offset: number;
  limit: number;
  order: 1 | -1;
  orderBy: "created";
};

export async function paginate<T extends Document>(
  collection: Collection<T>,
  pagination: Pagination,
) {
  const cursor = collection.find()
    .sort({ [pagination.orderBy]: pagination.order })
    .skip(pagination.offset)
    .limit(pagination.limit);
  return await cursor.toArray();
}
