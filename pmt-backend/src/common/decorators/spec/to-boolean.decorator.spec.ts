import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { IsBoolean, IsOptional, validateSync } from 'class-validator';

import { ToBoolean } from '../to-boolean.decorator';

class Query {
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  archived?: boolean = false;
}

function parse(raw: Record<string, unknown>) {
  return plainToInstance(Query, raw);
}

describe('ToBoolean', () => {
  it('parses false correctly, which @Type(() => Boolean) did not', () => {
    // The bug this decorator exists for: Boolean('false') is true, so
    // ?archived=false returned archived projects.
    expect(parse({ archived: 'false' }).archived).toBe(false);
  });

  it('parses true', () => {
    expect(parse({ archived: 'true' }).archived).toBe(true);
  });

  it('accepts 1 and 0', () => {
    expect(parse({ archived: '1' }).archived).toBe(true);
    expect(parse({ archived: '0' }).archived).toBe(false);
  });

  it('treats a bare flag as true', () => {
    // `?archived` with no value arrives as an empty string.
    expect(parse({ archived: '' }).archived).toBe(true);
  });

  it('is case and whitespace insensitive', () => {
    expect(parse({ archived: 'FALSE' }).archived).toBe(false);
    expect(parse({ archived: ' True ' }).archived).toBe(true);
  });

  it('leaves an already boolean value alone', () => {
    expect(parse({ archived: true }).archived).toBe(true);
    expect(parse({ archived: false }).archived).toBe(false);
  });

  it('keeps the default when the param is absent', () => {
    expect(parse({}).archived).toBe(false);
  });

  it('refuses a value it cannot parse rather than guessing', () => {
    // Silently coercing "yes" to true would mean a typo changes what the
    // caller gets back with no indication. A 400 naming the field is better.
    const parsed = parse({ archived: 'yes' });
    const errors = validateSync(parsed);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('archived');
  });
});
