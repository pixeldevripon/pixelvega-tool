/**
 * Unit tests for remainingHours.
 *
 * It is computed on the way out and never stored, so it cannot drift out of
 * sync with estimatedHours/actualHours the way a persisted column could. These
 * tests pin that contract, including the null case, which is the one a caller
 * is most likely to mishandle.
 */

import { withRemainingHours } from './project.mapper';

describe('withRemainingHours', () => {
  it('subtracts actual from estimated', () => {
    const result = withRemainingHours({ estimatedHours: 100, actualHours: 40 });
    expect(result.remainingHours).toBe(60);
  });

  it('returns null when there is no estimate, rather than 0 or a negative', () => {
    // "No estimate" and "nothing remaining" are different facts. Collapsing
    // them would tell a PM a project is fully consumed when it was never sized.
    const result = withRemainingHours({
      estimatedHours: null,
      actualHours: 40,
    });
    expect(result.remainingHours).toBeNull();
  });

  it('returns a negative number when actual has overrun the estimate', () => {
    // Overrun is real information, not something to clamp at zero.
    const result = withRemainingHours({ estimatedHours: 10, actualHours: 25 });
    expect(result.remainingHours).toBe(-15);
  });

  it('returns the full estimate when no time has been logged', () => {
    const result = withRemainingHours({ estimatedHours: 80, actualHours: 0 });
    expect(result.remainingHours).toBe(80);
  });

  it('returns 0 when actual exactly meets the estimate', () => {
    const result = withRemainingHours({ estimatedHours: 40, actualHours: 40 });
    expect(result.remainingHours).toBe(0);
  });

  it('handles a zero estimate as a real estimate, not as absent', () => {
    const result = withRemainingHours({ estimatedHours: 0, actualHours: 5 });
    expect(result.remainingHours).toBe(-5);
  });

  it('preserves every other field on the project it is given', () => {
    const input = {
      id: 'p1',
      name: 'Acme site',
      estimatedHours: 10,
      actualHours: 4,
      nested: { keep: true },
    };
    const result = withRemainingHours(input);
    expect(result).toEqual({ ...input, remainingHours: 6 });
  });

  it('does not mutate the project it is given', () => {
    const input = { estimatedHours: 10, actualHours: 4 };
    withRemainingHours(input);
    expect(input).not.toHaveProperty('remainingHours');
  });
});
