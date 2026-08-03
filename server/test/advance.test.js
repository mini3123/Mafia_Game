import { describe, it, expect } from 'vitest';
import { ROLE, PHASE } from '../src/game/roles.js';
import { submitNominate, submitJudge } from '../src/game/actions.js';
import { advancePhase } from '../src/game/phases.js';
import { makeRoom, idOf } from './helpers.js';

const SEVEN = [
  ROLE.MAFIA, ROLE.MAFIA, ROLE.SPY,
  ROLE.DOCTOR, ROLE.POLICE, ROLE.CITIZEN, ROLE.CITIZEN,
];

const opts = { now: 0, rng: () => 0 };

describe('advancePhase', () => {
  it('밤 다음은 낮 토론이다', () => {
    const room = makeRoom(SEVEN, { phase: PHASE.NIGHT });
    expect(advancePhase(room, opts)).toBe(PHASE.DAY_DISCUSSION);
  });

  it('낮 토론 다음은 지목 투표다', () => {
    const room = makeRoom(SEVEN, { phase: PHASE.DAY_DISCUSSION });
    expect(advancePhase(room, opts)).toBe(PHASE.VOTE_NOMINATE);
  });

  it('지목 대상이 나오면 최후 변론으로 간다', () => {
    const room = makeRoom(SEVEN, { phase: PHASE.VOTE_NOMINATE });
    submitNominate(room, 'p1', 'p4');
    submitNominate(room, 'p2', 'p4');
    expect(advancePhase(room, opts)).toBe(PHASE.DEFENSE);
    expect(room.nominee).toBe('p4');
  });

  it('지목이 동점이면 최후 변론을 건너뛰고 다음 밤으로 간다', () => {
    const room = makeRoom(SEVEN, { phase: PHASE.VOTE_NOMINATE, day: 1 });
    submitNominate(room, 'p1', 'p4');
    submitNominate(room, 'p2', 'p5');
    expect(advancePhase(room, opts)).toBe(PHASE.NIGHT);
    expect(room.day).toBe(2);
  });

  it('최후 변론 다음은 찬반 투표다', () => {
    const room = makeRoom(SEVEN, { phase: PHASE.DEFENSE });
    room.nominee = 'p4';
    expect(advancePhase(room, opts)).toBe(PHASE.VOTE_JUDGE);
  });

  it('처형되지 않으면 다음 밤으로 간다', () => {
    const room = makeRoom(SEVEN, { phase: PHASE.VOTE_JUDGE, day: 1 });
    room.nominee = 'p4';
    submitJudge(room, 'p1', false);
    submitJudge(room, 'p2', false);
    expect(advancePhase(room, opts)).toBe(PHASE.NIGHT);
    expect(room.day).toBe(2);
  });

  it('밤 살해로 승부가 나면 ENDED로 간다', () => {
    const room = makeRoom([ROLE.MAFIA, ROLE.MAFIA, ROLE.DOCTOR, ROLE.POLICE, ROLE.CITIZEN], {
      phase: PHASE.NIGHT,
    });
    room.night.mafiaPicks = { [idOf(room, ROLE.MAFIA, 0)]: idOf(room, ROLE.CITIZEN) };
    expect(advancePhase(room, opts)).toBe(PHASE.ENDED);
    expect(room.result.winner).toBe('MAFIA');
  });

  it('처형으로 승부가 나면 ENDED로 간다', () => {
    const room = makeRoom([ROLE.MAFIA, ROLE.DOCTOR, ROLE.POLICE, ROLE.CITIZEN, ROLE.CITIZEN], {
      phase: PHASE.VOTE_JUDGE,
    });
    room.nominee = idOf(room, ROLE.MAFIA);
    submitJudge(room, idOf(room, ROLE.DOCTOR), true);
    submitJudge(room, idOf(room, ROLE.POLICE), true);
    expect(advancePhase(room, opts)).toBe(PHASE.ENDED);
    expect(room.result.winner).toBe('CITIZEN');
  });

  it('ENDED에서는 더 진행하지 않는다', () => {
    const room = makeRoom(SEVEN, { phase: PHASE.ENDED });
    expect(advancePhase(room, opts)).toBe(PHASE.ENDED);
  });
});

describe('다음 밤으로 넘어갈 때의 초기화', () => {
  it('밤 행동과 투표 기록이 비워진다', () => {
    const room = makeRoom(SEVEN, { phase: PHASE.VOTE_JUDGE, day: 1 });
    room.nominee = 'p4';
    room.night.doctorSave = 'p5';
    submitJudge(room, 'p1', false);
    advancePhase(room, opts);
    expect(room.night).toEqual({
      mafiaPicks: {}, doctorSave: null, policeCheck: null, spyContact: null,
    });
    expect(room.votes).toEqual({});
    expect(room.judgeVotes).toEqual({});
    expect(room.nominee).toBeNull();
  });

  it('스파이가 알아낸 정보는 밤이 바뀌어도 남는다', () => {
    const room = makeRoom(SEVEN, { phase: PHASE.VOTE_JUDGE, day: 1 });
    room.spyKnownJobs = { p2: ROLE.DOCTOR };
    room.spyContacted = true;
    room.spyContactedOnDay = 1;
    advancePhase(room, opts);
    expect(room.spyKnownJobs).toEqual({ p2: ROLE.DOCTOR });
    expect(room.spyContacted).toBe(true);
    expect(room.spyContactedOnDay).toBe(1);
  });

  it('경찰 조사 기록은 남는다', () => {
    const room = makeRoom(SEVEN, { phase: PHASE.VOTE_JUDGE, day: 1 });
    room.policeResults = [{ day: 1, targetId: 'p2', isMafia: false }];
    advancePhase(room, opts);
    expect(room.policeResults).toHaveLength(1);
  });
});

describe('하루 전체를 돌린다', () => {
  it('밤 → 낮 → 지목 → 변론 → 찬반 → 밤 순서로 돈다', () => {
    const room = makeRoom(SEVEN, { phase: PHASE.NIGHT, day: 1 });
    expect(advancePhase(room, opts)).toBe(PHASE.DAY_DISCUSSION);
    expect(advancePhase(room, opts)).toBe(PHASE.VOTE_NOMINATE);
    submitNominate(room, 'p1', 'p4');
    expect(advancePhase(room, opts)).toBe(PHASE.DEFENSE);
    expect(advancePhase(room, opts)).toBe(PHASE.VOTE_JUDGE);
    submitJudge(room, 'p1', false);
    expect(advancePhase(room, opts)).toBe(PHASE.NIGHT);
    expect(room.day).toBe(2);
  });
});
