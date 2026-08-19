/**
 * Unit tests for CSV serialisation.
 *
 * Quoting is the whole job here. A cell containing a comma, a quote, or a
 * newline that is not escaped produces a file that opens misaligned in a
 * spreadsheet, which is a silent data corruption rather than a visible error.
 */

import { toCsv } from './csv.util';

describe('toCsv', () => {
  it('joins plain cells with commas and rows with CRLF', () => {
    expect(
      toCsv([
        ['a', 'b'],
        ['c', 'd'],
      ]),
    ).toBe('a,b\r\nc,d');
  });

  it('serialises numbers without quoting them', () => {
    expect(
      toCsv([
        ['hours', 40],
        ['rate', 12.5],
      ]),
    ).toBe('hours,40\r\nrate,12.5');
  });

  it('quotes a cell containing a comma', () => {
    expect(toCsv([['Doe, Jane']])).toBe('"Doe, Jane"');
  });

  it('quotes a cell containing a double quote, and doubles the quote', () => {
    expect(toCsv([['She said "hi"']])).toBe('"She said ""hi"""');
  });

  it('quotes a cell containing a newline', () => {
    expect(toCsv([['line one\nline two']])).toBe('"line one\nline two"');
  });

  it('quotes a cell containing a carriage return', () => {
    expect(toCsv([['line one\rline two']])).toBe('"line one\rline two"');
  });

  it('handles a cell that needs every escape at once', () => {
    expect(toCsv([['a,b "c"\nd']])).toBe('"a,b ""c""\nd"');
  });

  it('leaves a cell with no special characters unquoted', () => {
    expect(toCsv([['plain text here']])).toBe('plain text here');
  });

  it('emits an empty cell as empty rather than as a quoted empty string', () => {
    expect(toCsv([['a', '', 'c']])).toBe('a,,c');
  });

  it('returns an empty string for no rows', () => {
    expect(toCsv([])).toBe('');
  });

  it('handles a single row of a single cell', () => {
    expect(toCsv([['only']])).toBe('only');
  });

  it('round trips a realistic export row', () => {
    const csv = toCsv([
      ['Project', 'Developer', 'Hours', 'Note'],
      ['Acme, Inc site', 'Jane Doe', 12.5, 'Client said "ship it"'],
    ]);
    expect(csv).toBe(
      'Project,Developer,Hours,Note\r\n' +
        '"Acme, Inc site",Jane Doe,12.5,"Client said ""ship it"""',
    );
  });
});
