import { describe, expect, it } from '@jest/globals';
import { e1rm, parseRepRange, startingWeight, suggestNext, type SessionRecord } from '@/services/training/progression';
import { EXERCISE_LIBRARY } from '@/db/schema';
import { PROGRAMS } from '@/services/training/programs';

const cfg = { repMin: 8, repMax: 12, increment: 2.5, targetSets: 3 };
const session = (weight: number, reps: number[], date = '2026-11-10'): SessionRecord => ({
  date,
  sets: reps.map((r) => ({ weight, reps: r })),
});

describe('suggestNext (double progression)', () => {
  it('starts with the beginner weight when there is no history', () => {
    const s = suggestNext([], cfg, 40);
    expect(s.kind).toBe('start');
    expect(s.weight).toBe(40);
    expect(s.reps).toBe(8);
  });

  it('adds reps at the same weight while below the top of the range', () => {
    const s = suggestNext([session(60, [10, 9, 8])], cfg);
    expect(s.kind).toBe('reps');
    expect(s.weight).toBe(60);
    expect(s.reps).toBe(9);
  });

  it('increases the weight once every set hits the top of the range', () => {
    const s = suggestNext([session(60, [12, 12, 12])], cfg);
    expect(s.kind).toBe('increase');
    expect(s.weight).toBe(62.5);
    expect(s.reps).toBe(8);
  });

  it('does not increase when fewer sets than planned were done', () => {
    const s = suggestNext([session(60, [12, 12])], cfg);
    expect(s.kind).toBe('reps');
    expect(s.weight).toBe(60);
  });

  it('uses the heaviest weight as the working weight (ignores warm-ups)', () => {
    const s = suggestNext([{ date: 'd', sets: [{ weight: 20, reps: 15 }, ...session(60, [12, 12, 12]).sets] }], cfg);
    expect(s.weight).toBe(62.5);
  });

  it('repeats the weight after one bad session, deloads after two', () => {
    expect(suggestNext([session(62.5, [7, 6, 6])], cfg).kind).toBe('repeat');
    const d = suggestNext([session(62.5, [7, 6, 6], 'b'), session(62.5, [7, 7, 6], 'a')], cfg);
    expect(d.kind).toBe('deload');
    expect(d.weight).toBe(57.5);
  });

  it('progresses body-weight exercises by reps', () => {
    const s = suggestNext([session(0, [12, 10, 10])], { ...cfg, increment: 0 });
    expect(s.weight).toBe(0);
    expect(s.reps).toBe(11);
  });
});

describe('helpers', () => {
  it('e1rm (Epley)', () => {
    expect(e1rm(100, 1)).toBe(100);
    expect(e1rm(100, 10)).toBeCloseTo(133.33, 1);
  });
  it('parses rep ranges incl. Arabic digits', () => {
    expect(parseRepRange('8-12', { min: 1, max: 2 })).toEqual({ min: 8, max: 12 });
    expect(parseRepRange('٦-١٠', { min: 1, max: 2 })).toEqual({ min: 6, max: 10 });
    expect(parseRepRange('10', { min: 1, max: 2 })).toEqual({ min: 10, max: 10 });
    expect(parseRepRange('', { min: 8, max: 12 })).toEqual({ min: 8, max: 12 });
  });
  it('rounds starting weights to the increment', () => {
    expect(startingWeight(0.5, 80, 'male', 2.5)).toBe(40);
    expect(startingWeight(0.5, 80, 'female', 2.5)).toBe(25);
    expect(startingWeight(0, 80, 'male', 2.5)).toBeNull();
  });
  it('every program exercise exists in the library', () => {
    const names = new Set(EXERCISE_LIBRARY.map((e) => e[0]));
    for (const p of PROGRAMS) for (const d of p.days) for (const e of d.exercises) expect(names.has(e.name)).toBe(true);
  });
});
