import { describe, it, expect } from 'vitest';
import { ROLE, PHASE, PHASE_DURATION_MS } from '../src/game/roles.js';
import { killPlayer, setPhase } from '../src/game/state.js';
import { adjustPhaseTime, TIME_STEP_MS, MIN_REMAINING_MS } from '../src/game/actions.js';
import { makeRoom } from './helpers.js';

const SEVEN = [
  ROLE.MAFIA, ROLE.MAFIA, ROLE.SPY,
  ROLE.DOCTOR, ROLE.POLICE, ROLE.CITIZEN, ROLE.CITIZEN,
];

const DAY = PHASE_DURATION_MS[PHASE.DAY_DISCUSSION];

/** 낮 토론 방. now=0 기준으로 종료 시각은 DAY. */
const dayRoom = () => makeRoom(SEVEN, { phase: PHASE.DAY_DISCUSSION, now: 0 });

describe('adjustPhaseTime', () => {
  it('연장하면 20초 늘어난다', () => {
    const room = dayRoom();
    expect(adjustPhaseTime(room, 'p1', 'EXTEND', { now: 0 })).toEqual({ ok: true });
    expect(room.phaseEndsAt).toBe(DAY + TIME_STEP_MS);
  });

  it('단축하면 20초 줄어든다', () => {
    const room = dayRoom();
    expect(adjustPhaseTime(room, 'p1', 'SHORTEN', { now: 0 })).toEqual({ ok: true });
    expect(room.phaseEndsAt).toBe(DAY - TIME_STEP_MS);
  });

  it('한 사람은 한 페이즈에 한 번만 쓸 수 있다', () => {
    const room = dayRoom();
    adjustPhaseTime(room, 'p1', 'SHORTEN', { now: 0 });
    expect(adjustPhaseTime(room, 'p1', 'SHORTEN', { now: 0 }))
      .toEqual({ ok: false, code: 'ALREADY_ADJUSTED' });
    expect(room.phaseEndsAt).toBe(DAY - TIME_STEP_MS);
  });

  it('사람마다 따로 쓸 수 있어 인당 20초씩 쌓인다', () => {
    const room = dayRoom();
    adjustPhaseTime(room, 'p1', 'SHORTEN', { now: 0 });
    adjustPhaseTime(room, 'p2', 'SHORTEN', { now: 0 });
    adjustPhaseTime(room, 'p3', 'SHORTEN', { now: 0 });
    expect(room.phaseEndsAt).toBe(DAY - TIME_STEP_MS * 3);
  });

  it('연장과 단축이 서로 상쇄된다', () => {
    const room = dayRoom();
    adjustPhaseTime(room, 'p1', 'SHORTEN', { now: 0 });
    adjustPhaseTime(room, 'p2', 'EXTEND', { now: 0 });
    expect(room.phaseEndsAt).toBe(DAY);
  });

  it('아무리 줄여도 5초는 남는다', () => {
    const room = dayRoom();
    // 남은 시간(120초)보다 많이 줄이려 해도 바닥에서 멈춘다.
    for (const p of room.players) adjustPhaseTime(room, p.id, 'SHORTEN', { now: 0 });
    expect(room.phaseEndsAt).toBe(MIN_REMAINING_MS);
  });

  it('5초보다 적게 남았을 때 단축해도 시간이 도리어 늘지 않는다', () => {
    const room = dayRoom();
    room.phaseEndsAt = 3_000;
    adjustPhaseTime(room, 'p1', 'SHORTEN', { now: 0 });
    expect(room.phaseEndsAt).toBe(3_000);
  });

  it('15초 남았을 때 20초 단축하면 5초가 된다', () => {
    const room = dayRoom();
    room.phaseEndsAt = 15_000;
    adjustPhaseTime(room, 'p1', 'SHORTEN', { now: 0 });
    expect(room.phaseEndsAt).toBe(5_000);
  });

  it('아무리 늘려도 기본 시간의 두 배를 넘지 않는다', () => {
    const room = dayRoom();
    for (const p of room.players) adjustPhaseTime(room, p.id, 'EXTEND', { now: 0 });
    expect(room.phaseEndsAt).toBeLessThanOrEqual(DAY * 2);
  });

  it('죽은 사람은 쓸 수 없다', () => {
    const room = dayRoom();
    killPlayer(room, 'p1');
    expect(adjustPhaseTime(room, 'p1', 'SHORTEN', { now: 0 }))
      .toEqual({ ok: false, code: 'NOT_ALIVE' });
  });

  it('시간이 없는 페이즈에서는 쓸 수 없다', () => {
    const room = makeRoom(SEVEN, { phase: PHASE.ENDED, now: 0 });
    expect(adjustPhaseTime(room, 'p1', 'SHORTEN', { now: 0 }))
      .toEqual({ ok: false, code: 'NOT_TIMED_PHASE' });
  });

  it('엉뚱한 방향을 거부한다', () => {
    const room = dayRoom();
    expect(adjustPhaseTime(room, 'p1', 'FASTER', { now: 0 }))
      .toEqual({ ok: false, code: 'INVALID_ADJUST' });
  });

  it('밤에도 쓸 수 있다', () => {
    const room = makeRoom(SEVEN, { phase: PHASE.NIGHT, now: 0 });
    expect(adjustPhaseTime(room, 'p1', 'SHORTEN', { now: 0 })).toEqual({ ok: true });
  });

  it('누가 어느 방향으로 썼는지 기록된다', () => {
    const room = dayRoom();
    adjustPhaseTime(room, 'p1', 'SHORTEN', { now: 0 });
    adjustPhaseTime(room, 'p2', 'EXTEND', { now: 0 });
    expect(room.timeAdjustedBy).toEqual({ p1: 'SHORTEN', p2: 'EXTEND' });
  });

  it('페이즈가 바뀌면 전원이 다시 쓸 수 있다', () => {
    const room = dayRoom();
    adjustPhaseTime(room, 'p1', 'SHORTEN', { now: 0 });
    setPhase(room, PHASE.VOTE_NOMINATE, 0);
    expect(room.timeAdjustedBy).toEqual({});
    expect(adjustPhaseTime(room, 'p1', 'SHORTEN', { now: 0 })).toEqual({ ok: true });
  });
});
