import { describe, it, expect } from 'vitest';
import { seasonAt } from '../src/seasons.js';

describe('seizoenen', () => {
  it('zomer: vol blad en groen', () => {
    const s = seasonAt(new Date('2026-07-15T12:00:00Z'), 50);
    expect(s.leaf).toBe(1);
    expect(s.autumn).toBe(0);
    expect(s.winter).toBe(false);
  });

  it('herfst (eind oktober): nog blad, maar in herfstkleuren', () => {
    const s = seasonAt(new Date('2026-10-26T12:00:00Z'), 50);
    expect(s.leaf).toBeGreaterThan(0.9);
    expect(s.autumn).toBeGreaterThan(0.9);
  });

  it('winter: kale bomen', () => {
    const s = seasonAt(new Date('2026-01-15T12:00:00Z'), 50);
    expect(s.leaf).toBe(0);
    expect(s.winter).toBe(true);
    expect(seasonAt(new Date('2026-12-20T12:00:00Z'), 50).leaf).toBe(0);
  });

  it('lente: bladeren groeien aan en zijn fris groen', () => {
    const s = seasonAt(new Date('2026-04-20T12:00:00Z'), 50);
    expect(s.leaf).toBeGreaterThan(0);
    expect(s.leaf).toBeLessThan(1);
    expect(s.spring).toBeGreaterThan(0.3);
  });

  it('zuidelijk halfrond: seizoenen zijn een half jaar verschoven', () => {
    const north = seasonAt(new Date('2026-01-15T12:00:00Z'), 50);
    const south = seasonAt(new Date('2026-01-15T12:00:00Z'), -34);
    expect(north.leaf).toBe(0);
    expect(south.leaf).toBe(1);
  });
});
