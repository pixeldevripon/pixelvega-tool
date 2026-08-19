// A small seeded random generator, so every reseed produces the exact same
// database. Node's own Math.random cannot be seeded, and randomUUID gives a
// new value every run, which would change every id on every reseed.

// mulberry32. Small, fast, and good enough for test data.
function mulberry32(seed: number) {
  let state = seed >>> 0;
  return function next(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HEX = '0123456789abcdef';
const ALPHANUM =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export class Rand {
  private readonly next: () => number;

  constructor(seed: number) {
    this.next = mulberry32(seed);
  }

  // Float in [0, 1).
  float(): number {
    return this.next();
  }

  // Integer in [min, max], both ends included.
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  // Integer from a [min, max] tuple, the shape used by config.ts.
  intFrom(range: readonly [number, number]): number {
    return this.int(range[0], range[1]);
  }

  // Float in [min, max], rounded to the given number of decimals.
  decimal(min: number, max: number, decimals = 1): number {
    const value = min + this.next() * (max - min);
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
  }

  // True with the given probability, e.g. chance(0.25) is true a quarter of
  // the time.
  chance(probability: number): boolean {
    return this.next() < probability;
  }

  // One item from a list.
  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }

  // One item from a list, or undefined with the given probability. Useful for
  // optional columns that should sometimes be null.
  maybe<T>(items: readonly T[], nullChance = 0.3): T | undefined {
    return this.chance(nullChance) ? undefined : this.pick(items);
  }

  // A new list with the items in random order. The input is left alone.
  shuffle<T>(items: readonly T[]): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  // `count` distinct items, or the whole list if it is shorter than count.
  sample<T>(items: readonly T[], count: number): T[] {
    return this.shuffle(items).slice(0, Math.min(count, items.length));
  }

  // A hex string of the given length.
  hex(length: number): string {
    let out = '';
    for (let i = 0; i < length; i++) out += HEX[Math.floor(this.next() * 16)];
    return out;
  }

  // A 32 character alphanumeric id, the same shape better auth generates for
  // its own User, Account, Session, and Verification rows.
  authId(): string {
    let out = '';
    for (let i = 0; i < 32; i++) {
      out += ALPHANUM[Math.floor(this.next() * ALPHANUM.length)];
    }
    return out;
  }

  // A valid version 4 uuid, built from this generator so it stays stable
  // across reseeds. Used for every model whose id defaults to uuid().
  uuid(): string {
    const bytes: string[] = [];
    for (let i = 0; i < 16; i++) {
      bytes.push(
        Math.floor(this.next() * 256)
          .toString(16)
          .padStart(2, '0'),
      );
    }
    // Set the version to 4 and the variant to the RFC 4122 form.
    bytes[6] = ((parseInt(bytes[6], 16) & 0x0f) | 0x40)
      .toString(16)
      .padStart(2, '0');
    bytes[8] = ((parseInt(bytes[8], 16) & 0x3f) | 0x80)
      .toString(16)
      .padStart(2, '0');
    const h = bytes.join('');
    return [
      h.slice(0, 8),
      h.slice(8, 12),
      h.slice(12, 16),
      h.slice(16, 20),
      h.slice(20, 32),
    ].join('-');
  }

  // A timestamp between two dates.
  dateBetween(start: Date, end: Date): Date {
    const from = start.getTime();
    const to = end.getTime();
    return new Date(from + Math.floor(this.next() * (to - from)));
  }
}

// Midnight UTC on the given day. Matches toDateOnly() in
// daily-work-report.service.ts, so a seeded report lands on the same day the
// app would compute for itself.
export function utcDateOnly(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

// The same day at a given hour and minute UTC.
export function atUtcTime(day: Date, hour: number, minute = 0): Date {
  return new Date(
    Date.UTC(
      day.getUTCFullYear(),
      day.getUTCMonth(),
      day.getUTCDate(),
      hour,
      minute,
    ),
  );
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

// Counts both ends, so Jan 1 to Jan 1 is 1 day. Mirrors
// daysBetweenInclusive() in src/common/utils/date.util.ts.
export function daysBetweenInclusive(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / MS_PER_DAY) + 1;
}

// Friday is the weekly off day at this company, so work history skips it.
export function isFriday(date: Date): boolean {
  return date.getUTCDay() === 5;
}
