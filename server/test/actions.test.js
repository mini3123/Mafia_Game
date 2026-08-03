import { describe, it, expect } from 'vitest';
import { ROLE, PHASE } from '../src/game/roles.js';
import { killPlayer, emptyNight } from '../src/game/state.js';
import { ACTION, submitNightAction, shouldEndNightEarly } from '../src/game/actions.js';
import { makeRoom, idOf } from './helpers.js';

const SEVEN = [
  ROLE.MAFIA, ROLE.MAFIA, ROLE.SPY,
  ROLE.DOCTOR, ROLE.POLICE, ROLE.CITIZEN, ROLE.CITIZEN,
];

describe('submitNightAction — 공통 검증', () => {
  it('밤이 아니면 거부한다', () => {
    const room = makeRoom(SEVEN, { phase: PHASE.DAY_DISCUSSION });
    const result = submitNightAction(room, idOf(room, ROLE.MAFIA), {
      type: ACTION.MAFIA_KILL, targetId: idOf(room, ROLE.CITIZEN),
    });
    expect(result).toEqual({ ok: false, code: 'NOT_NIGHT' });
  });

  it('죽은 사람의 행동을 거부한다', () => {
    const room = makeRoom(SEVEN);
    const mafiaId = idOf(room, ROLE.MAFIA);
    killPlayer(room, mafiaId);
    const result = submitNightAction(room, mafiaId, {
      type: ACTION.MAFIA_KILL, targetId: idOf(room, ROLE.CITIZEN),
    });
    expect(result).toEqual({ ok: false, code: 'NOT_ALIVE' });
  });

  it('역할에 없는 행동을 거부한다', () => {
    const room = makeRoom(SEVEN);
    const result = submitNightAction(room, idOf(room, ROLE.CITIZEN), {
      type: ACTION.MAFIA_KILL, targetId: idOf(room, ROLE.DOCTOR),
    });
    expect(result).toEqual({ ok: false, code: 'WRONG_ROLE' });
  });

  it('죽은 사람을 대상으로 지목할 수 없다', () => {
    const room = makeRoom(SEVEN);
    const citizenId = idOf(room, ROLE.CITIZEN);
    killPlayer(room, citizenId);
    const result = submitNightAction(room, idOf(room, ROLE.MAFIA), {
      type: ACTION.MAFIA_KILL, targetId: citizenId,
    });
    expect(result).toEqual({ ok: false, code: 'INVALID_TARGET' });
  });

  it('없는 사람을 대상으로 지목할 수 없다', () => {
    const room = makeRoom(SEVEN);
    const result = submitNightAction(room, idOf(room, ROLE.MAFIA), {
      type: ACTION.MAFIA_KILL, targetId: 'nobody',
    });
    expect(result).toEqual({ ok: false, code: 'INVALID_TARGET' });
  });
});

describe('마피아 살해 지목', () => {
  it('다른 마피아를 지목할 수 없다', () => {
    const room = makeRoom(SEVEN);
    const result = submitNightAction(room, idOf(room, ROLE.MAFIA, 0), {
      type: ACTION.MAFIA_KILL, targetId: idOf(room, ROLE.MAFIA, 1),
    });
    expect(result).toEqual({ ok: false, code: 'CANNOT_TARGET_MAFIA' });
  });

  it('자기 자신을 지목할 수 없다', () => {
    const room = makeRoom(SEVEN);
    const mafiaId = idOf(room, ROLE.MAFIA);
    const result = submitNightAction(room, mafiaId, {
      type: ACTION.MAFIA_KILL, targetId: mafiaId,
    });
    expect(result).toEqual({ ok: false, code: 'SELF_NOT_ALLOWED' });
  });

  it('마피아별로 각자의 지목이 따로 기록된다', () => {
    const room = makeRoom(SEVEN);
    const [m0, m1] = [idOf(room, ROLE.MAFIA, 0), idOf(room, ROLE.MAFIA, 1)];
    const [c0, c1] = [idOf(room, ROLE.CITIZEN, 0), idOf(room, ROLE.CITIZEN, 1)];
    submitNightAction(room, m0, { type: ACTION.MAFIA_KILL, targetId: c0 });
    submitNightAction(room, m1, { type: ACTION.MAFIA_KILL, targetId: c1 });
    expect(room.night.mafiaPicks).toEqual({ [m0]: c0, [m1]: c1 });
  });

  it('같은 마피아가 다시 지목하면 덮어쓴다', () => {
    const room = makeRoom(SEVEN);
    const m0 = idOf(room, ROLE.MAFIA, 0);
    submitNightAction(room, m0, { type: ACTION.MAFIA_KILL, targetId: idOf(room, ROLE.CITIZEN, 0) });
    submitNightAction(room, m0, { type: ACTION.MAFIA_KILL, targetId: idOf(room, ROLE.CITIZEN, 1) });
    expect(room.night.mafiaPicks[m0]).toBe(idOf(room, ROLE.CITIZEN, 1));
  });
});

describe('의사 보호', () => {
  it('자기 자신을 지목할 수 있다', () => {
    const room = makeRoom(SEVEN);
    const doctorId = idOf(room, ROLE.DOCTOR);
    const result = submitNightAction(room, doctorId, {
      type: ACTION.DOCTOR_SAVE, targetId: doctorId,
    });
    expect(result).toEqual({ ok: true });
    expect(room.night.doctorSave).toBe(doctorId);
  });

  it('같은 사람을 연속으로 지목할 수 있다', () => {
    const room = makeRoom(SEVEN);
    const doctorId = idOf(room, ROLE.DOCTOR);
    const targetId = idOf(room, ROLE.CITIZEN);
    submitNightAction(room, doctorId, { type: ACTION.DOCTOR_SAVE, targetId });
    room.night = emptyNight();
    room.day = 2;
    const result = submitNightAction(room, doctorId, { type: ACTION.DOCTOR_SAVE, targetId });
    expect(result).toEqual({ ok: true });
    expect(room.night.doctorSave).toBe(targetId);
  });
});

describe('경찰 조사', () => {
  it('자기 자신을 조사할 수 없다', () => {
    const room = makeRoom(SEVEN);
    const policeId = idOf(room, ROLE.POLICE);
    const result = submitNightAction(room, policeId, {
      type: ACTION.POLICE_CHECK, targetId: policeId,
    });
    expect(result).toEqual({ ok: false, code: 'SELF_NOT_ALLOWED' });
  });

  it('대상을 기록만 하고 결과는 아직 만들지 않는다', () => {
    const room = makeRoom(SEVEN);
    const targetId = idOf(room, ROLE.MAFIA);
    submitNightAction(room, idOf(room, ROLE.POLICE), {
      type: ACTION.POLICE_CHECK, targetId,
    });
    expect(room.night.policeCheck).toBe(targetId);
    expect(room.policeResults).toEqual([]);
  });
});

describe('스파이 접선', () => {
  it('자기 자신에게 접선할 수 없다', () => {
    const room = makeRoom(SEVEN);
    const spyId = idOf(room, ROLE.SPY);
    const result = submitNightAction(room, spyId, {
      type: ACTION.SPY_CONTACT, targetId: spyId,
    });
    expect(result).toEqual({ ok: false, code: 'SELF_NOT_ALLOWED' });
  });

  it('시민을 지목하면 직업만 알아내고 접선은 실패한다', () => {
    const room = makeRoom(SEVEN);
    const targetId = idOf(room, ROLE.DOCTOR);
    const result = submitNightAction(room, idOf(room, ROLE.SPY), {
      type: ACTION.SPY_CONTACT, targetId,
    });
    expect(result).toEqual({ ok: true });
    expect(room.spyKnownJobs).toEqual({ [targetId]: ROLE.DOCTOR });
    expect(room.spyContacted).toBe(false);
  });

  it('경찰과 달리 정확한 직업을 알아낸다', () => {
    const room = makeRoom(SEVEN);
    submitNightAction(room, idOf(room, ROLE.SPY), {
      type: ACTION.SPY_CONTACT, targetId: idOf(room, ROLE.POLICE),
    });
    expect(room.spyKnownJobs[idOf(room, ROLE.POLICE)]).toBe(ROLE.POLICE);
  });

  it('마피아를 지목하면 즉시 접선에 성공한다', () => {
    const room = makeRoom(SEVEN, { day: 3 });
    const mafiaId = idOf(room, ROLE.MAFIA);
    submitNightAction(room, idOf(room, ROLE.SPY), {
      type: ACTION.SPY_CONTACT, targetId: mafiaId,
    });
    expect(room.spyContacted).toBe(true);
    expect(room.spyContactedOnDay).toBe(3);
    expect(room.spyKnownJobs[mafiaId]).toBe(ROLE.MAFIA);
  });

  it('알아낸 직업은 다음 밤에도 누적 유지된다', () => {
    const room = makeRoom(SEVEN);
    const spyId = idOf(room, ROLE.SPY);
    submitNightAction(room, spyId, { type: ACTION.SPY_CONTACT, targetId: idOf(room, ROLE.DOCTOR) });
    room.night = emptyNight();
    room.day = 2;
    submitNightAction(room, spyId, { type: ACTION.SPY_CONTACT, targetId: idOf(room, ROLE.POLICE) });
    expect(room.spyKnownJobs).toEqual({
      [idOf(room, ROLE.DOCTOR)]: ROLE.DOCTOR,
      [idOf(room, ROLE.POLICE)]: ROLE.POLICE,
    });
  });

  it('접선에 성공한 뒤에도 다음 밤에 다른 사람의 직업을 조사한다', () => {
    const room = makeRoom(SEVEN);
    const spyId = idOf(room, ROLE.SPY);
    submitNightAction(room, spyId, { type: ACTION.SPY_CONTACT, targetId: idOf(room, ROLE.MAFIA) });
    room.night = emptyNight();
    room.day = 2;
    const result = submitNightAction(room, spyId, {
      type: ACTION.SPY_CONTACT, targetId: idOf(room, ROLE.DOCTOR),
    });
    expect(result).toEqual({ ok: true });
    expect(room.spyKnownJobs[idOf(room, ROLE.DOCTOR)]).toBe(ROLE.DOCTOR);
  });

  it('즉시 정보를 얻는 스파이는 같은 밤에 두 명을 조사할 수 없다', () => {
    const room = makeRoom(SEVEN);
    const spyId = idOf(room, ROLE.SPY);
    submitNightAction(room, spyId, {
      type: ACTION.SPY_CONTACT, targetId: idOf(room, ROLE.DOCTOR),
    });
    expect(submitNightAction(room, spyId, {
      type: ACTION.SPY_CONTACT, targetId: idOf(room, ROLE.POLICE),
    })).toEqual({ ok: false, code: 'ALREADY_ACTED' });
  });
});

describe('shouldEndNightEarly', () => {
  function allActed(room) {
    for (const p of room.players.filter((x) => x.alive && x.role === ROLE.MAFIA)) {
      submitNightAction(room, p.id, { type: ACTION.MAFIA_KILL, targetId: idOf(room, ROLE.CITIZEN, 0) });
    }
    submitNightAction(room, idOf(room, ROLE.DOCTOR), {
      type: ACTION.DOCTOR_SAVE, targetId: idOf(room, ROLE.CITIZEN, 1),
    });
    submitNightAction(room, idOf(room, ROLE.POLICE), {
      type: ACTION.POLICE_CHECK, targetId: idOf(room, ROLE.CITIZEN, 0),
    });
  }

  it('행동할 사람이 남아 있으면 false', () => {
    const room = makeRoom(SEVEN);
    expect(shouldEndNightEarly(room)).toBe(false);
  });

  it('전원이 행동을 마치면 true', () => {
    const room = makeRoom(SEVEN);
    allActed(room);
    submitNightAction(room, idOf(room, ROLE.SPY), {
      type: ACTION.SPY_CONTACT, targetId: idOf(room, ROLE.CITIZEN, 0),
    });
    expect(shouldEndNightEarly(room)).toBe(true);
  });

  it('그 밤에 접선이 성공했다면 전원이 마쳤어도 false', () => {
    const room = makeRoom(SEVEN);
    allActed(room);
    submitNightAction(room, idOf(room, ROLE.SPY), {
      type: ACTION.SPY_CONTACT, targetId: idOf(room, ROLE.MAFIA),
    });
    expect(shouldEndNightEarly(room)).toBe(false);
  });

  it('이전 밤에 접선한 스파이도 이번 밤 조사 전에는 기다린다', () => {
    const room = makeRoom(SEVEN);
    room.spyContacted = true;
    room.spyContactedOnDay = 1;
    room.day = 2;
    allActed(room);
    expect(shouldEndNightEarly(room)).toBe(false);
    submitNightAction(room, idOf(room, ROLE.SPY), {
      type: ACTION.SPY_CONTACT, targetId: idOf(room, ROLE.DOCTOR),
    });
    expect(shouldEndNightEarly(room)).toBe(true);
  });

  it('죽은 역할은 기다리지 않는다', () => {
    const room = makeRoom(SEVEN);
    killPlayer(room, idOf(room, ROLE.DOCTOR));
    killPlayer(room, idOf(room, ROLE.POLICE));
    killPlayer(room, idOf(room, ROLE.SPY));
    for (const p of room.players.filter((x) => x.alive && x.role === ROLE.MAFIA)) {
      submitNightAction(room, p.id, { type: ACTION.MAFIA_KILL, targetId: idOf(room, ROLE.CITIZEN, 0) });
    }
    expect(shouldEndNightEarly(room)).toBe(true);
  });
});
