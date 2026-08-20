import { joinName, splitName } from '../name.util';

describe('joinName', () => {
  it('joins the two halves with one space', () => {
    expect(joinName({ firstName: 'Jabed', lastName: 'Hossain' })).toBe(
      'Jabed Hossain',
    );
  });

  it('uses whichever half is present', () => {
    expect(joinName({ firstName: 'Madonna', lastName: null })).toBe('Madonna');
    expect(joinName({ firstName: null, lastName: 'Hossain' })).toBe('Hossain');
  });

  it('trims each half rather than producing a double space', () => {
    expect(joinName({ firstName: ' Jabed ', lastName: ' Hossain ' })).toBe(
      'Jabed Hossain',
    );
  });

  it('returns null when there is nothing to write', () => {
    // The caller reads null as "leave `name` alone". `User.name` is NOT NULL,
    // so clearing both halves must not blank it: a person with no name is a row
    // nothing can render.
    expect(joinName({ firstName: null, lastName: null })).toBeNull();
    expect(joinName({ firstName: '  ', lastName: '' })).toBeNull();
  });
});

describe('splitName', () => {
  it('splits on the first space, keeping the rest as the last name', () => {
    expect(splitName('Jabed Hossain Khan')).toEqual({
      firstName: 'Jabed',
      lastName: 'Hossain Khan',
    });
  });

  it('treats a single word as a first name with no last name', () => {
    // Never the same word twice, which is what a naive "fall back to the whole
    // string" produces.
    expect(splitName('Madonna')).toEqual({
      firstName: 'Madonna',
      lastName: null,
    });
  });

  it('collapses runs of whitespace before splitting', () => {
    expect(splitName('  Jabed   Hossain  ')).toEqual({
      firstName: 'Jabed',
      lastName: 'Hossain',
    });
  });

  it('returns both halves null for an empty name', () => {
    expect(splitName('   ')).toEqual({ firstName: null, lastName: null });
  });

  it('round trips a two part name', () => {
    // The property that matters: neither direction may lose information for the
    // ordinary case, or the account screen and the rest of the app disagree.
    const name = 'Jabed Hossain';
    expect(joinName(splitName(name))).toBe(name);
  });
});
