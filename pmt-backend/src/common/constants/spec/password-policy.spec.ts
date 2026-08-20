import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_RULES,
  describePasswordPolicyFailure,
  failedPasswordRules,
} from '@/common/constants/password-policy';
import { generateUnusedPassword } from '@/common/utils/password.util';

describe('PASSWORD_RULES', () => {
  it('states the minimum length in its own label, so the two cannot drift', () => {
    const minLength = PASSWORD_RULES.find((rule) => rule.key === 'MIN_LENGTH')!;
    expect(minLength.label).toContain(String(PASSWORD_MIN_LENGTH));
  });

  it('gives every rule a pattern a client can compile with no flags', () => {
    for (const rule of PASSWORD_RULES) {
      expect(() => new RegExp(rule.pattern)).not.toThrow();
    }
  });

  it('has no rule that can backtrack', () => {
    // An unauthenticated route evaluating a pattern with nested quantifiers is
    // a denial of service. Every pattern here is a single character class or a
    // bounded repetition of `.`.
    for (const rule of PASSWORD_RULES) {
      expect(rule.pattern).not.toMatch(/[*+?)]\s*[*+]/);
    }
  });
});

describe('failedPasswordRules', () => {
  it('passes a password meeting every rule', () => {
    expect(failedPasswordRules('Correct-Horse9!')).toEqual([]);
  });

  it('reports the length rule for a short password', () => {
    expect(failedPasswordRules('Ab1!').map((rule) => rule.key)).toContain(
      'MIN_LENGTH',
    );
  });

  it('reports every missing class at once, not one at a time', () => {
    // This route is rate limited. Reporting one failure per attempt turns a
    // single mistake into five round trips.
    expect(failedPasswordRules('aaaaaaaaaaaaaa').map((r) => r.key)).toEqual([
      'UPPERCASE',
      'NUMBER',
      'SPECIAL',
    ]);
  });

  it('counts a space as a special character', () => {
    // A passphrase is the password style this policy should encourage, and
    // "correct horse battery" would otherwise be refused for having no symbol.
    expect(failedPasswordRules('Correct horse9')).toEqual([]);
  });

  it('accepts a unicode symbol as special', () => {
    expect(failedPasswordRules('Correct9horse£')).toEqual([]);
  });
});

describe('describePasswordPolicyFailure', () => {
  it('returns null when the password is acceptable', () => {
    expect(describePasswordPolicyFailure('Correct-Horse9!')).toBeNull();
  });

  it('names every missing requirement in one sentence', () => {
    const message = describePasswordPolicyFailure('aaaaaaaaaaaaaa')!;
    expect(message).toContain('at least 1 uppercase letter');
    expect(message).toContain('at least 1 number');
    expect(message).toContain('at least 1 special character');
  });
});

describe('generateUnusedPassword', () => {
  it('always satisfies the policy it will be checked against', () => {
    // The invite flow goes through `/sign-up/email`, which the policy hook
    // gates. A generated password missing a class would be an invite that fails
    // for one new hire and nobody else, which is the worst kind of bug to be
    // handed. 200 samples is enough to catch a generator that only usually
    // covers every class.
    for (let i = 0; i < 200; i++) {
      expect(failedPasswordRules(generateUnusedPassword())).toEqual([]);
    }
  });

  it('is never shorter than the policy, whatever length a caller asks for', () => {
    expect(generateUnusedPassword(4).length).toBe(PASSWORD_MIN_LENGTH);
  });

  it('produces a different value every time', () => {
    const values = new Set(
      Array.from({ length: 50 }, () => generateUnusedPassword()),
    );
    expect(values.size).toBe(50);
  });
});
