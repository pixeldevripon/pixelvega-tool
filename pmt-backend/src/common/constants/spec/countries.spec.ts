import {
  COUNTRY_CODES,
  COUNTRY_OPTIONS,
  isKnownCountry,
  toCountryOption,
} from '@/common/constants/countries';

describe('COUNTRY_OPTIONS', () => {
  it('covers the ISO 3166-1 list rather than a handful', () => {
    expect(COUNTRY_OPTIONS.length).toBeGreaterThan(200);
  });

  it('is sorted by label, which is the order the select renders in', () => {
    // Sorting in a browser is exactly what D4 forbids, so the order has to be
    // right on the way out.
    const labels = COUNTRY_OPTIONS.map((option) => option.label);
    expect(labels).toEqual(
      [...labels].sort((a, b) => a.localeCompare(b, 'en')),
    );
  });

  it('holds no duplicate codes', () => {
    expect(new Set(COUNTRY_CODES).size).toBe(COUNTRY_CODES.length);
  });

  it('uses two letter uppercase codes throughout', () => {
    expect(COUNTRY_CODES.every((code) => /^[A-Z]{2}$/.test(code))).toBe(true);
  });

  it('never labels a country with its own code', () => {
    // That is what `Intl.DisplayNames` returns for a region it does not know,
    // and shipping "XK" as both the value and the label is worse than omitting
    // the row.
    expect(
      COUNTRY_OPTIONS.filter((option) => option.value === option.label),
    ).toEqual([]);
  });

  it('exposes codes derived from the same table as the labels', () => {
    expect(COUNTRY_CODES).toEqual(COUNTRY_OPTIONS.map((o) => o.value));
  });
});

describe('isKnownCountry', () => {
  it('accepts a real code', () => {
    expect(isKnownCountry('BD')).toBe(true);
  });

  it('refuses two uppercase letters that are not a country', () => {
    expect(isKnownCountry('ZZ')).toBe(false);
  });

  it('is case sensitive, because the stored form is uppercase', () => {
    expect(isKnownCountry('bd')).toBe(false);
  });
});

describe('toCountryOption', () => {
  it('carries the label so no client ships a country list', () => {
    expect(toCountryOption('BD')).toEqual({ value: 'BD', label: 'Bangladesh' });
  });

  it('returns null for nothing stored', () => {
    expect(toCountryOption(null)).toBeNull();
    expect(toCountryOption('')).toBeNull();
  });

  it('returns null for a code that is no longer a country', () => {
    // A territory can be dissolved between the day someone saved it and the day
    // they open the form. Rendering a bare "AN" is worse than rendering nothing.
    expect(toCountryOption('AN')).toBeNull();
  });
});
