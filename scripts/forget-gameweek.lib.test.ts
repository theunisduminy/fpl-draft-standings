import { describe, expect, it } from 'vitest';

import {
  APPLY_FLAG,
  MAX_GAMEWEEK,
  MIN_GAMEWEEK,
  parseArgs,
  parseGameweek,
  parseLeagueId,
  PROD_FLAG,
  resolveTarget,
  sliceDescriptor,
  TABLES,
  usage,
  UsageError,
} from './forget-gameweek.lib.mjs';

describe('parseGameweek', () => {
  it('accepts the boundary gameweeks', () => {
    expect(parseGameweek('1')).toBe(1);
    expect(parseGameweek('38')).toBe(38);
    expect(parseGameweek(7)).toBe(7);
  });

  it.each([
    ['0'],
    ['39'],
    ['1.5'],
    ['seven'],
    [''],
    [null],
    [undefined],
    [Number.NaN],
  ])('refuses %p with a UsageError', (raw) => {
    expect(() => parseGameweek(raw)).toThrowError(UsageError);
  });

  it('names the valid range in the refusal', () => {
    expect(() => parseGameweek('39')).toThrowError(
      `${MIN_GAMEWEEK}..${MAX_GAMEWEEK}`,
    );
  });
});

describe('parseLeagueId', () => {
  it('accepts a positive integer', () => {
    expect(parseLeagueId('8337')).toBe(8337);
  });

  it.each([['0'], ['-3'], ['8.5'], ['abc'], [''], [undefined], [null]])(
    'refuses %p with a UsageError',
    (raw) => {
      expect(() => parseLeagueId(raw)).toThrowError(UsageError);
    },
  );
});

describe('resolveTarget', () => {
  const sandboxUrl = 'postgresql://sandbox/dummy';
  const prodUrl = 'postgresql://prod/dummy';

  it('defaults to sandbox', () => {
    expect(
      resolveTarget({ prodFlag: false, sandboxUrl, prodUrl }),
    ).toMatchObject({ name: 'sandbox', url: sandboxUrl });
  });

  it('reaches production only behind the explicit prod flag', () => {
    expect(
      resolveTarget({ prodFlag: true, sandboxUrl, prodUrl }),
    ).toMatchObject({ name: 'PRODUCTION', url: prodUrl });
  });

  it('refuses when the chosen target has no connection string', () => {
    expect(() =>
      resolveTarget({ prodFlag: false, sandboxUrl: undefined, prodUrl }),
    ).toThrowError(UsageError);
    expect(() =>
      resolveTarget({ prodFlag: true, sandboxUrl, prodUrl: undefined }),
    ).toThrowError(UsageError);
  });

  it('never falls back across targets', () => {
    expect(() =>
      resolveTarget({ prodFlag: true, sandboxUrl, prodUrl: '' }),
    ).toThrowError(UsageError);
  });
});

describe('parseArgs', () => {
  it('parses a bare gameweek as a dry run on sandbox', () => {
    expect(parseArgs(['7'])).toEqual({
      gameweek: 7,
      useProd: false,
      apply: false,
    });
  });

  it('honours the apply and prod flags', () => {
    expect(parseArgs(['7', APPLY_FLAG, PROD_FLAG])).toEqual({
      gameweek: 7,
      useProd: true,
      apply: true,
    });
  });

  it('returns help for --help and -h', () => {
    expect(parseArgs(['--help'])).toEqual({ help: true });
    expect(parseArgs(['-h'])).toEqual({ help: true });
  });

  it('refuses a missing, doubled, unknown, or invalid gameweek', () => {
    expect(() => parseArgs([])).toThrowError(UsageError);
    expect(() => parseArgs(['7', '8'])).toThrowError(UsageError);
    expect(() => parseArgs(['7', '--force'])).toThrowError(UsageError);
    expect(() => parseArgs(['39'])).toThrowError(UsageError);
  });
});

describe('sliceDescriptor', () => {
  it('covers scores, marker, and candidate tables for one slice', () => {
    const slice = sliceDescriptor(8337, 7);

    expect(slice).toEqual({
      leagueId: 8337,
      gameweek: 7,
      tables: [...TABLES],
      label: 'GW7 for league 8337',
    });
    expect(TABLES).toEqual([
      'gameweek_scores',
      'gameweeks',
      'finalisation_candidates',
    ]);
  });

  it('returns a copy of the table list', () => {
    const slice = sliceDescriptor(8337, 7);
    slice.tables.push('gameweek_scores');

    expect(TABLES).toHaveLength(3);
  });
});

describe('usage', () => {
  it('documents the dry run default, apply flag, and prod flag', () => {
    const text = usage();

    expect(text).toContain(APPLY_FLAG);
    expect(text).toContain(PROD_FLAG);
    expect(text).toContain('Dry run');
    expect(text).toContain(MAX_GAMEWEEK.toString());
    expect(text).toContain('/api/cron/revalidate');
  });
});
