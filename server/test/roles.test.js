import { describe, it, expect } from 'vitest';
import { ROLE, roleCountsFor, assignRoles } from '../src/game/roles.js';

describe('roleCountsFor', () => {
  it('5명이면 마피아 1 · 스파이 없음 · 의사 1 · 경찰 1 · 시민 2', () => {
    expect(roleCountsFor(5)).toEqual({ MAFIA: 1, SPY: 0, DOCTOR: 1, POLICE: 1, CITIZEN: 2 });
  });

  it('6명까지는 스파이가 없다', () => {
    expect(roleCountsFor(6).SPY).toBe(0);
  });

  it('7명이면 마피아 2 · 스파이 1 · 시민 2', () => {
    expect(roleCountsFor(7)).toEqual({ MAFIA: 2, SPY: 1, DOCTOR: 1, POLICE: 1, CITIZEN: 2 });
  });

  it('9명이면 마피아 2 · 스파이 1 · 시민 4', () => {
    expect(roleCountsFor(9)).toEqual({ MAFIA: 2, SPY: 1, DOCTOR: 1, POLICE: 1, CITIZEN: 4 });
  });

  it('10명이면 마피아 3 · 스파이 1 · 시민 4', () => {
    expect(roleCountsFor(10)).toEqual({ MAFIA: 3, SPY: 1, DOCTOR: 1, POLICE: 1, CITIZEN: 4 });
  });

  it('12명이면 마피아 3 · 스파이 1 · 시민 6', () => {
    expect(roleCountsFor(12)).toEqual({ MAFIA: 3, SPY: 1, DOCTOR: 1, POLICE: 1, CITIZEN: 6 });
  });

  it('배분한 인원의 합이 항상 전체 인원과 같다', () => {
    for (let n = 5; n <= 12; n++) {
      const counts = roleCountsFor(n);
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      expect(total).toBe(n);
    }
  });

  it('5명 미만이거나 12명을 넘으면 던진다', () => {
    expect(() => roleCountsFor(4)).toThrow();
    expect(() => roleCountsFor(13)).toThrow();
  });
});

describe('assignRoles', () => {
  const ids = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'];

  it('배분표대로 정확한 수의 역할을 나눠준다', () => {
    const assigned = assignRoles(ids, () => 0.5);
    const counts = {};
    for (const id of ids) counts[assigned[id]] = (counts[assigned[id]] ?? 0) + 1;
    expect(counts).toEqual({ MAFIA: 2, SPY: 1, DOCTOR: 1, POLICE: 1, CITIZEN: 2 });
  });

  it('모든 플레이어가 정확히 하나의 역할을 받는다', () => {
    const assigned = assignRoles(ids, () => 0.5);
    expect(Object.keys(assigned).sort()).toEqual([...ids].sort());
    for (const id of ids) {
      expect(Object.values(ROLE)).toContain(assigned[id]);
    }
  });

  it('난수를 주입하면 배정이 결정적이다', () => {
    const a = assignRoles(ids, makeRng(1));
    const b = assignRoles(ids, makeRng(1));
    expect(a).toEqual(b);
  });
});

// 테스트 전용 결정적 난수 생성기
function makeRng(seed) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}
