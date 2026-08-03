import { describe, it, expect } from 'vitest';
import { ROLE, PHASE } from '../src/game/roles.js';
import { killPlayer } from '../src/game/state.js';
import { submitJudge } from '../src/game/actions.js';
import { resolveNight, tallyJudge } from '../src/game/phases.js';
import { executionAnnouncement, nightAnnouncement } from '../src/game/announce.js';
import { makeRoom, idOf } from './helpers.js';

const SEVEN = [
  ROLE.MAFIA, ROLE.MAFIA, ROLE.SPY,
  ROLE.DOCTOR, ROLE.POLICE, ROLE.CITIZEN, ROLE.CITIZEN,
];

describe('nightAnnouncement', () => {
  it('밤에 죽은 사람과 진영을 알린다', () => {
    const room = makeRoom(SEVEN);
    const victimId = idOf(room, ROLE.CITIZEN, 0);
    room.night.mafiaPicks = { [idOf(room, ROLE.MAFIA, 0)]: victimId };
    resolveNight(room, { now: 0, rng: () => 0 });
    expect(nightAnnouncement(room)).toBe('사람6님이 밤 사이 사망했습니다. 시민이었습니다.');
  });

  it('마피아가 죽으면 마피아로 알린다', () => {
    const room = makeRoom(SEVEN);
    const victimId = idOf(room, ROLE.MAFIA, 1);
    // 마피아는 동료를 못 죽이지만, 진영 표기를 확인하기 위해 직접 죽인다.
    killPlayer(room, victimId);
    room.lastNightResult = { killedId: victimId, blocked: false };
    expect(nightAnnouncement(room)).toBe('사람2님이 밤 사이 사망했습니다. 마피아였습니다.');
  });

  it('의사가 죽어도 시민으로만 알린다', () => {
    const room = makeRoom(SEVEN);
    const victimId = idOf(room, ROLE.DOCTOR);
    room.night.mafiaPicks = { [idOf(room, ROLE.MAFIA, 0)]: victimId };
    resolveNight(room, { now: 0, rng: () => 0 });
    expect(nightAnnouncement(room)).toContain('시민이었습니다');
    expect(nightAnnouncement(room)).not.toContain('의사');
  });

  it('아무도 안 죽으면 그렇다고 알린다', () => {
    const room = makeRoom(SEVEN);
    resolveNight(room, { now: 0, rng: () => 0 });
    expect(nightAnnouncement(room)).toBe('밤 사이 아무도 죽지 않았습니다.');
  });

  it('밤 결과가 없으면 알릴 것도 없다', () => {
    expect(nightAnnouncement(makeRoom(SEVEN))).toBeNull();
  });
});

describe('executionAnnouncement', () => {
  function judged(role, approve) {
    const room = makeRoom(SEVEN, { phase: PHASE.VOTE_JUDGE });
    room.nominee = idOf(room, role);
    submitJudge(room, 'p1', approve);
    submitJudge(room, 'p2', approve);
    tallyJudge(room, { now: 0 });
    return room;
  }

  it('처형된 사람과 진영을 알린다', () => {
    const room = judged(ROLE.MAFIA, true);
    expect(executionAnnouncement(room)).toBe('사람1님이 처형되었습니다. 마피아였습니다.');
  });

  it('스파이를 처형해도 시민으로 알린다', () => {
    const room = judged(ROLE.SPY, true);
    expect(executionAnnouncement(room)).toBe('사람3님이 처형되었습니다. 시민이었습니다.');
  });

  it('의사를 처형해도 시민으로만 알린다', () => {
    const room = judged(ROLE.DOCTOR, true);
    expect(executionAnnouncement(room)).not.toContain('의사');
  });

  it('처형되지 않으면 살아남았다고 알린다', () => {
    const room = judged(ROLE.CITIZEN, false);
    expect(executionAnnouncement(room)).toBe('사람6님은 처형되지 않았습니다.');
  });

  it('투표 대상이 없었으면 알릴 것도 없다', () => {
    expect(executionAnnouncement(makeRoom(SEVEN))).toBeNull();
  });
});
