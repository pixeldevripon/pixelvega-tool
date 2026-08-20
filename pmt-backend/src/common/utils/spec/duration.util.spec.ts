import {
  formatDeadlineLabel,
  formatDuration,
  formatHoursLabel,
  toHours,
} from '../duration.util';

describe('formatDuration', () => {
  it('keeps an absent duration absent', () => {
    expect(formatDuration(null)).toBeNull();
    expect(formatDuration(undefined)).toBeNull();
  });

  it('does not treat zero as absent', () => {
    // A segment with zero elapsed minutes is a fact, not a missing value.
    expect(formatDuration(0)).toBe('0m');
  });

  it('shows minutes alone under an hour', () => {
    expect(formatDuration(1)).toBe('1m');
    expect(formatDuration(59)).toBe('59m');
  });

  it('omits a zero remainder on the hour', () => {
    // The frontend disagreed with itself here: two copies said "1h", two said
    // "1h 0m". "1h" is the one that reads like a person wrote it.
    expect(formatDuration(60)).toBe('1h');
    expect(formatDuration(540)).toBe('9h');
  });

  it('shows both parts otherwise', () => {
    expect(formatDuration(90)).toBe('1h 30m');
    expect(formatDuration(450)).toBe('7h 30m');
    expect(formatDuration(61)).toBe('1h 1m');
  });

  it('loses nothing: the parts always reconstruct the input', () => {
    for (const minutes of [0, 1, 59, 60, 61, 90, 450, 539, 540, 1441]) {
      const text = formatDuration(minutes) as string;
      const hours = Number(/(\d+)h/.exec(text)?.[1] ?? 0);
      const mins = Number(/(\d+)m/.exec(text)?.[1] ?? 0);
      expect(hours * 60 + mins).toBe(minutes);
    }
  });

  it('renders a negative duration as negative rather than as nonsense', () => {
    // Reachable through an overrun figure (logged beyond an estimate), where
    // the sign is the whole point.
    expect(formatDuration(-90)).toBe('-1h 30m');
    expect(formatDuration(-45)).toBe('-45m');
  });
});

describe('toHours', () => {
  it('rounds to two places, the precision every hours figure in the API uses', () => {
    expect(toHours(450)).toBe(7.5);
    expect(toHours(60)).toBe(1);
    expect(toHours(0)).toBe(0);
  });

  it('rounds rather than truncating', () => {
    expect(toHours(20)).toBe(0.33);
    expect(toHours(40)).toBe(0.67);
  });

  it('never returns float noise', () => {
    // 1/3 of an hour is 0.3333...; a client rendering that raw shows a number
    // nobody wants to read.
    expect(String(toHours(20))).toBe('0.33');
  });
});

describe('formatHoursLabel', () => {
  it('keeps an absent value absent', () => {
    expect(formatHoursLabel(null)).toBeNull();
    expect(formatHoursLabel(undefined)).toBeNull();
  });

  it('does not treat zero as absent', () => {
    expect(formatHoursLabel(0)).toBe('0m');
  });

  it('reads a whole number of hours without a minute part', () => {
    expect(formatHoursLabel(7)).toBe('7h');
  });

  it('turns the fraction into minutes', () => {
    expect(formatHoursLabel(7.5)).toBe('7h 30m');
    expect(formatHoursLabel(0.25)).toBe('15m');
  });

  it('reads a repeating decimal as minutes rather than as itself', () => {
    // This is the case it exists for: `56.083333333333336` reached a screen
    // verbatim once, because a mapper rendered the number instead of a label.
    expect(formatHoursLabel(56.083333333333336)).toBe('56h 5m');
  });

  it('keeps a negative overrun negative', () => {
    // Remaining hours go below zero when an estimate is passed, and the sign is
    // the whole message.
    expect(formatHoursLabel(-2.5)).toBe('-2h 30m');
  });
});

describe('formatDeadlineLabel', () => {
  it.each([
    [null, null],
    [0, 'due today'],
    [1, 'due tomorrow'],
    [12, 'in 12 days'],
    [-1, '1 day overdue'],
    [-5, '5 days overdue'],
  ])('%s days reads as %s', (days, expected) => {
    // Takes days already measured against the server clock. A browser three
    // hours off would put "due today" on the wrong day.
    expect(formatDeadlineLabel(days)).toBe(expected);
  });
});
