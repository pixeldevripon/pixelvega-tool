export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export async function paginate<T>(
  findMany: (args: { skip: number; take: number }) => Promise<T[]>,
  count: () => Promise<number>,
  page: number,
  pageSize: number,
): Promise<PaginatedResult<T>> {
  const [items, total] = await Promise.all([
    findMany({ skip: (page - 1) * pageSize, take: pageSize }),
    count(),
  ]);
  return { items, total, page, pageSize };
}
