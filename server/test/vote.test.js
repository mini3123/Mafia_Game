import { describe, it, expect } from 'vitest';
import { ROLE, PHASE } from '../src/game/roles.js';
import { playerById, killPlayer } from '../src/game/state.js';
import { submitNominate, submitJudge } from '../src/game/actions.js';
import { tallyNominate, tallyJudge } from '../src/game/phases.js';
import { makeRoom, idOf } from './helpers.js';

const SEVEN = [
  ROLE.MAFIA, ROLE.MAFIA, ROLE.SPY,
  ROLE.DOCTOR, ROLE.POLICE, ROLE.CITIZEN, ROLE.CITIZEN,
];

const nominateRoom = () => makeRoom(SEVEN, { phase: PHASE.VOTE_NOMINATE });
const judgeRoom = () => makeRoom(SEVEN, { phase: PHASE.VOTE_JUDGE });

describe('submitNominate', () => {
  it('지목 투표 페이즈가 아니면 거부한다', () => {
    const room = makeRoom(SEVEN, { phase: PHASE.NIGHT });
    expect(submitNominate(room, 'p1', 'p2')).toEqual({ ok: false, code: 'NOT_NOMINATE_PHASE' });
  });

  it('죽은 사람은 투표할 수 없다', () => {
    const room = nominateRoom();
    killPlayer(room, 'p1');
    expect(submitNominate(room, 'p1', 'p2')).toEqual({ ok: false, code: 'NOT_ALIVE' });
  });

  it('죽은 사람에게 투표할 수 없다', () => {
    const room = nominateRoom();
    killPlayer(room, 'p2');
    expect(submitNominate(room, 'p1', 'p2')).toEqual({ ok: false, code: 'INVALID_TARGET' });
  });

  it('자기 자신에게 투표할 수 없다', () => {
    const room = nominateRoom();
    expect(submitNominate(room, 'p1', 'p1')).toEqual({ ok: false, code: 'SELF_NOT_ALLOWED' });
  });

  it('기권할 수 있다', () => {
    const room = nominateRoom();
    expect(submitNominate(room, 'p1', null)).toEqual({ ok: true });
    expect(room.votes.p1).toBeNull();
  });

  it('다시 투표하면 덮어쓴다', () => {
    const room = nominateRoom();
    submitNominate(room, 'p1', 'p2');
    submitNominate(room, 'p1', 'p3');
    expect(room.votes.p1).toBe('p3');
  });
});

describe('tallyNominate', () => {
  it('최다 득표자가 유일하면 그 사람이 최후 변론 대상이 된다', () => {
    const room = nominateRoom();
    submitNominate(room, 'p1', 'p4');
    submitNominate(room, 'p2', 'p4');
    submitNominate(room, 'p3', 'p5');
    tallyNominate(room);
    expect(room.nominee).toBe('p4');
  });

  it('동점이면 대상이 없다', () => {
    const room = nominateRoom();
    submitNominate(room, 'p1', 'p4');
    submitNominate(room, 'p2', 'p5');
    tallyNominate(room);
    expect(room.nominee).toBeNull();
  });

  it('전원 기권이면 대상이 없다', () => {
    const room = nominateRoom();
    for (const p of room.players) submitNominate(room, p.id, null);
    tallyNominate(room);
    expect(room.nominee).toBeNull();
  });

  it('아무도 투표하지 않으면 대상이 없다', () => {
    const room = nominateRoom();
    tallyNominate(room);
    expect(room.nominee).toBeNull();
  });

  it('기권표는 집계에서 빠진다', () => {
    const room = nominateRoom();
    submitNominate(room, 'p1', 'p4');
    submitNominate(room, 'p2', null);
    submitNominate(room, 'p3', null);
    tallyNominate(room);
    expect(room.nominee).toBe('p4');
  });
});

describe('submitJudge', () => {
  it('찬반 투표 페이즈가 아니면 거부한다', () => {
    const room = makeRoom(SEVEN, { phase: PHASE.DEFENSE });
    room.nominee = 'p4';
    expect(submitJudge(room, 'p1', true)).toEqual({ ok: false, code: 'NOT_JUDGE_PHASE' });
  });

  it('지목된 당사자는 투표할 수 없다', () => {
    const room = judgeRoom();
    room.nominee = 'p4';
    expect(submitJudge(room, 'p4', false)).toEqual({ ok: false, code: 'IS_NOMINEE' });
  });

  it('죽은 사람은 투표할 수 없다', () => {
    const room = judgeRoom();
    room.nominee = 'p4';
    killPlayer(room, 'p1');
    expect(submitJudge(room, 'p1', true)).toEqual({ ok: false, code: 'NOT_ALIVE' });
  });

  it('찬성과 반대를 기록한다', () => {
    const room = judgeRoom();
    room.nominee = 'p4';
    submitJudge(room, 'p1', true);
    submitJudge(room, 'p2', false);
    expect(room.judgeVotes).toEqual({ p1: true, p2: false });
  });

  it('찬반을 제출하지 않은 요청은 반대표로 바꾸지 않고 거부한다', () => {
    const room = judgeRoom();
    room.nominee = 'p4';
    expect(submitJudge(room, 'p1', undefined))
      .toEqual({ ok: false, code: 'INVALID_VOTE' });
    expect(room.judgeVotes).toEqual({});
  });
});

describe('tallyJudge', () => {
  function setup(votes) {
    const room = judgeRoom();
    room.nominee = 'p4';
    for (const [voter, approve] of Object.entries(votes)) submitJudge(room, voter, approve);
    return room;
  }

  it('찬성이 반대보다 많으면 처형한다', () => {
    const room = setup({ p1: true, p2: true, p3: false });
    tallyJudge(room, { now: 0 });
    expect(playerById(room, 'p4').alive).toBe(false);
    expect(room.lastExecution).toEqual({ nomineeId: 'p4', yes: 2, no: 1, executed: true });
  });

  it('동수면 살아남는다', () => {
    const room = setup({ p1: true, p2: false });
    tallyJudge(room, { now: 0 });
    expect(playerById(room, 'p4').alive).toBe(true);
    expect(room.lastExecution.executed).toBe(false);
  });

  it('반대가 많으면 살아남는다', () => {
    const room = setup({ p1: true, p2: false, p3: false });
    tallyJudge(room, { now: 0 });
    expect(playerById(room, 'p4').alive).toBe(true);
  });

  it('아무도 투표하지 않으면 살아남는다', () => {
    const room = setup({});
    tallyJudge(room, { now: 0 });
    expect(playerById(room, 'p4').alive).toBe(true);
  });

  it('집계 후 대상이 비워진다', () => {
    const room = setup({ p1: true, p2: true });
    tallyJudge(room, { now: 0 });
    expect(room.nominee).toBeNull();
  });

  it('처형된 사람의 진영만 공개된다', () => {
    const room = judgeRoom();
    const doctorId = idOf(room, ROLE.DOCTOR);
    room.nominee = doctorId;
    submitJudge(room, 'p1', true);
    submitJudge(room, 'p2', true);
    tallyJudge(room, { now: 0 });
    expect(playerById(room, doctorId).revealedTeam).toBe('CITIZEN');
  });

  it('스파이를 처형해도 시민으로 공개된다', () => {
    const room = judgeRoom();
    const spyId = idOf(room, ROLE.SPY);
    room.nominee = spyId;
    submitJudge(room, 'p1', true);
    submitJudge(room, 'p2', true);
    tallyJudge(room, { now: 0 });
    expect(playerById(room, spyId).revealedTeam).toBe('CITIZEN');
  });

  it('처형으로 마피아가 전멸하면 시민이 승리한다', () => {
    const room = makeRoom([ROLE.MAFIA, ROLE.DOCTOR, ROLE.POLICE, ROLE.CITIZEN, ROLE.CITIZEN], {
      phase: PHASE.VOTE_JUDGE,
    });
    room.nominee = idOf(room, ROLE.MAFIA);
    submitJudge(room, idOf(room, ROLE.DOCTOR), true);
    submitJudge(room, idOf(room, ROLE.POLICE), true);
    tallyJudge(room, { now: 0 });
    expect(room.result.winner).toBe('CITIZEN');
  });
});
