import { describe, it, expect } from 'vitest';
import { ROLE } from '../src/game/roles.js';
import { playerById } from '../src/game/state.js';
import { resolveNight } from '../src/game/phases.js';
import { makeRoom, idOf } from './helpers.js';

const SEVEN = [
  ROLE.MAFIA, ROLE.MAFIA, ROLE.SPY,
  ROLE.DOCTOR, ROLE.POLICE, ROLE.CITIZEN, ROLE.CITIZEN,
];

describe('resolveNight — 살해와 보호', () => {
  it('마피아가 지목한 사람이 죽는다', () => {
    const room = makeRoom(SEVEN);
    const victimId = idOf(room, ROLE.CITIZEN, 0);
    room.night.mafiaPicks = { [idOf(room, ROLE.MAFIA, 0)]: victimId };
    resolveNight(room, { now: 0, rng: () => 0 });
    expect(playerById(room, victimId).alive).toBe(false);
    expect(room.lastNightResult).toEqual({ killedId: victimId, blocked: false });
  });

  it('의사가 정확히 그 사람을 지목하면 아무도 죽지 않는다', () => {
    const room = makeRoom(SEVEN);
    const victimId = idOf(room, ROLE.CITIZEN, 0);
    room.night.mafiaPicks = { [idOf(room, ROLE.MAFIA, 0)]: victimId };
    room.night.doctorSave = victimId;
    resolveNight(room, { now: 0, rng: () => 0 });
    expect(playerById(room, victimId).alive).toBe(true);
    expect(room.lastNightResult).toEqual({ killedId: null, blocked: true });
  });

  it('의사가 다른 사람을 지목하면 대상이 죽는다', () => {
    const room = makeRoom(SEVEN);
    const victimId = idOf(room, ROLE.CITIZEN, 0);
    room.night.mafiaPicks = { [idOf(room, ROLE.MAFIA, 0)]: victimId };
    room.night.doctorSave = idOf(room, ROLE.CITIZEN, 1);
    resolveNight(room, { now: 0, rng: () => 0 });
    expect(playerById(room, victimId).alive).toBe(false);
  });

  it('아무도 지목하지 않으면 살해가 없다', () => {
    const room = makeRoom(SEVEN);
    resolveNight(room, { now: 0, rng: () => 0 });
    expect(room.lastNightResult).toEqual({ killedId: null, blocked: false });
    expect(room.players.every((p) => p.alive)).toBe(true);
  });

  it('마피아 지목이 갈리면 최다 득표 대상이 죽는다', () => {
    const room = makeRoom([
      ROLE.MAFIA, ROLE.MAFIA, ROLE.MAFIA,
      ROLE.SPY, ROLE.DOCTOR, ROLE.POLICE,
      ROLE.CITIZEN, ROLE.CITIZEN, ROLE.CITIZEN, ROLE.CITIZEN,
    ]);
    const [c0, c1] = [idOf(room, ROLE.CITIZEN, 0), idOf(room, ROLE.CITIZEN, 1)];
    room.night.mafiaPicks = {
      [idOf(room, ROLE.MAFIA, 0)]: c0,
      [idOf(room, ROLE.MAFIA, 1)]: c0,
      [idOf(room, ROLE.MAFIA, 2)]: c1,
    };
    resolveNight(room, { now: 0, rng: () => 0 });
    expect(playerById(room, c0).alive).toBe(false);
    expect(playerById(room, c1).alive).toBe(true);
  });

  it('동점이면 후보 중 하나가 죽는다', () => {
    const room = makeRoom(SEVEN);
    const [c0, c1] = [idOf(room, ROLE.CITIZEN, 0), idOf(room, ROLE.CITIZEN, 1)];
    room.night.mafiaPicks = {
      [idOf(room, ROLE.MAFIA, 0)]: c0,
      [idOf(room, ROLE.MAFIA, 1)]: c1,
    };
    resolveNight(room, { now: 0, rng: () => 0.99 });
    const dead = room.players.filter((p) => !p.alive);
    expect(dead).toHaveLength(1);
    expect([c0, c1]).toContain(dead[0].id);
  });
});

describe('resolveNight — 경찰 조사 결과', () => {
  it('마피아를 조사하면 isMafia가 true', () => {
    const room = makeRoom(SEVEN, { day: 2 });
    const targetId = idOf(room, ROLE.MAFIA);
    room.night.policeCheck = targetId;
    resolveNight(room, { now: 0, rng: () => 0 });
    expect(room.policeResults).toEqual([{ day: 2, targetId, isMafia: true }]);
  });

  it('스파이를 조사하면 isMafia가 false', () => {
    const room = makeRoom(SEVEN, { day: 2 });
    const targetId = idOf(room, ROLE.SPY);
    room.night.policeCheck = targetId;
    resolveNight(room, { now: 0, rng: () => 0 });
    expect(room.policeResults).toEqual([{ day: 2, targetId, isMafia: false }]);
  });

  it('조사 결과가 밤마다 누적된다', () => {
    const room = makeRoom(SEVEN, { day: 1 });
    room.night.policeCheck = idOf(room, ROLE.CITIZEN, 0);
    resolveNight(room, { now: 0, rng: () => 0 });
    room.day = 2;
    room.night = {
      mafiaPicks: {}, doctorSave: null,
      policeCheck: idOf(room, ROLE.MAFIA), spyContact: null,
    };
    resolveNight(room, { now: 0, rng: () => 0 });
    expect(room.policeResults).toHaveLength(2);
    expect(room.policeResults[1].isMafia).toBe(true);
  });

  it('조사하지 않았으면 결과가 늘지 않는다', () => {
    const room = makeRoom(SEVEN);
    resolveNight(room, { now: 0, rng: () => 0 });
    expect(room.policeResults).toEqual([]);
  });
});

describe('resolveNight — 승리 판정', () => {
  it('밤 살해로 마피아 승리 조건이 채워지면 결과가 확정된다', () => {
    // 마피아 2 · 그 외 3. 한 명이 죽으면 2 >= 2가 되어 마피아 승리.
    const room = makeRoom([
      ROLE.MAFIA, ROLE.MAFIA, ROLE.DOCTOR, ROLE.POLICE, ROLE.CITIZEN,
    ]);
    room.night.mafiaPicks = { [idOf(room, ROLE.MAFIA, 0)]: idOf(room, ROLE.CITIZEN) };
    resolveNight(room, { now: 0, rng: () => 0 });
    expect(room.result.winner).toBe('MAFIA');
  });

  it('승리 조건이 안 채워지면 결과가 없다', () => {
    const room = makeRoom(SEVEN);
    room.night.mafiaPicks = { [idOf(room, ROLE.MAFIA, 0)]: idOf(room, ROLE.CITIZEN, 0) };
    resolveNight(room, { now: 0, rng: () => 0 });
    expect(room.result).toBeNull();
  });
});
