import 'reflect-metadata';
import { IsDateString, IsOptional, validateSync } from 'class-validator';

import { IsNotBefore } from './is-not-before.validator';

class Range {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  @IsNotBefore('startDate')
  endDate?: string;
}

function check(startDate?: string, endDate?: string) {
  const dto = new Range();
  dto.startDate = startDate;
  dto.endDate = endDate;
  return validateSync(dto);
}

describe('IsNotBefore', () => {
  it('accepts an end after the start', () => {
    expect(check('2026-08-01', '2026-08-31')).toHaveLength(0);
  });

  it('accepts an end equal to the start, since a one day range is valid', () => {
    expect(check('2026-08-01', '2026-08-01')).toHaveLength(0);
  });

  it('rejects an end before the start, naming both fields', () => {
    const errors = check('2026-08-31', '2026-08-01');
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('endDate');
    expect(Object.values(errors[0].constraints ?? {})[0]).toBe(
      'endDate cannot be before startDate',
    );
  });

  it('compares full ISO timestamps correctly, not only dates', () => {
    expect(
      check('2026-08-01T10:00:00.000Z', '2026-08-01T09:00:00.000Z'),
    ).toHaveLength(1);
    expect(
      check('2026-08-01T09:00:00.000Z', '2026-08-01T10:00:00.000Z'),
    ).toHaveLength(0);
  });

  it('passes when either side is absent', () => {
    // Requiredness is a separate rule. Reporting "cannot be before" for a
    // missing field would be a confusing answer to a different question.
    expect(check(undefined, '2026-08-01')).toHaveLength(0);
    expect(check('2026-08-01', undefined)).toHaveLength(0);
    expect(check(undefined, undefined)).toHaveLength(0);
  });

  it('crosses a month and a year boundary correctly', () => {
    expect(check('2026-12-31', '2027-01-01')).toHaveLength(0);
    expect(check('2027-01-01', '2026-12-31')).toHaveLength(1);
  });
});
