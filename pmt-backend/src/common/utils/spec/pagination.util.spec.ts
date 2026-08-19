/**
 * Unit tests for the shared paginate() helper.
 *
 * Every paginated endpoint routes through this, so an off by one in the skip
 * arithmetic would shift or duplicate a row on every list in the app.
 */

import { paginate } from '../pagination.util';

describe('paginate', () => {
  it('requests skip 0 for the first page', () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);
    return paginate(findMany, count, 1, 20).then(() => {
      expect(findMany).toHaveBeenCalledWith({ skip: 0, take: 20 });
    });
  });

  it('offsets by exactly one page for page 2', () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);
    return paginate(findMany, count, 2, 20).then(() => {
      expect(findMany).toHaveBeenCalledWith({ skip: 20, take: 20 });
    });
  });

  it('offsets correctly for a deep page', () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);
    return paginate(findMany, count, 7, 25).then(() => {
      expect(findMany).toHaveBeenCalledWith({ skip: 150, take: 25 });
    });
  });

  it('returns the documented response shape', async () => {
    const items = [{ id: 'a' }, { id: 'b' }];
    const result = await paginate(
      jest.fn().mockResolvedValue(items),
      jest.fn().mockResolvedValue(57),
      3,
      2,
    );
    expect(result).toEqual({ items, total: 57, page: 3, pageSize: 2 });
  });

  it('reports the FULL total, not the size of the current page', async () => {
    // The client needs the unpaginated count to render page controls.
    const result = await paginate(
      jest.fn().mockResolvedValue([{ id: 'a' }]),
      jest.fn().mockResolvedValue(999),
      1,
      1,
    );
    expect(result.total).toBe(999);
    expect(result.items).toHaveLength(1);
  });

  it('returns an empty page rather than throwing when there are no rows', async () => {
    const result = await paginate(
      jest.fn().mockResolvedValue([]),
      jest.fn().mockResolvedValue(0),
      1,
      20,
    );
    expect(result).toEqual({ items: [], total: 0, page: 1, pageSize: 20 });
  });

  it('runs the query and the count concurrently, not in sequence', async () => {
    // They are independent. Awaiting them in series doubles the latency of
    // every list endpoint in the app.
    const order: string[] = [];
    const findMany = jest.fn().mockImplementation(async () => {
      order.push('findMany:start');
      await new Promise((r) => setTimeout(r, 10));
      order.push('findMany:end');
      return [];
    });
    const count = jest.fn().mockImplementation(async () => {
      order.push('count:start');
      await new Promise((r) => setTimeout(r, 10));
      order.push('count:end');
      return 0;
    });

    await paginate(findMany, count, 1, 20);

    // Both start before either finishes.
    expect(order.slice(0, 2)).toEqual(['findMany:start', 'count:start']);
  });
});
