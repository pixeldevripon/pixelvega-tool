import { COUNTED_TABLES, SEEDED_TABLES, schemaTables } from '../reset';

/**
 * The seed's two hand written table lists, checked against the schema without a
 * database.
 *
 * `resetDatabase` truncates every name in `SEEDED_TABLES` in ONE statement, and
 * `TRUNCATE` has no `IF EXISTS`. One stale name therefore aborts the whole reset
 * with a bare `42P01` before a single row is written, which is what happened
 * when `PasswordResetCode` outlived its table: `pnpm seed` died on its first
 * statement and nothing failed at compile time, because it is raw SQL.
 *
 * `COUNTED_TABLES` fails later and worse: its `$queryRawUnsafe` runs in the
 * final report, so a stale name there crashes after the data is already in.
 */
describe.each([
  ['SEEDED_TABLES', SEEDED_TABLES],
  ['COUNTED_TABLES', COUNTED_TABLES],
])('%s', (_name, tables: readonly string[]) => {
  const schema = schemaTables();

  it('names only tables the schema actually has', () => {
    expect(tables.filter((table) => !schema.includes(table))).toEqual([]);
  });

  it('covers every table in the schema', () => {
    // A table the reset forgets keeps its rows across `pnpm seed`, so the
    // "wipe and rebuild" the command promises quietly stops being true. A table
    // the report forgets is simply invisible in the summary.
    expect(schema.filter((table) => !tables.includes(table))).toEqual([]);
  });

  it('lists each table once', () => {
    expect([...new Set(tables)]).toEqual([...tables]);
  });
});

describe('schemaTables', () => {
  it('reads the real generated client, not a hardcoded list', () => {
    // The whole guard rests on this being derived rather than written down. If
    // it ever became a literal, both suites above would pass forever.
    const schema = schemaTables();
    expect(schema.length).toBeGreaterThan(20);
    expect(schema).toContain('User');
    expect(schema).not.toContain('PasswordResetCode');
  });
});
