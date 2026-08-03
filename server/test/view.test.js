import { describe, it, expect } from 'vitest';
import { ROLE, PHASE } from '../src/game/roles.js';
import { killPlayer } from '../src/game/state.js';
import { ACTION, submitNightAction, submitNominate } from '../src/game/actions.js';
import { viewFor } from '../src/game/view.js';
import { makeRoom, idOf } from './helpers.js';

const SEVEN = [
  ROLE.MAFIA, ROLE.MAFIA, ROLE.SPY,
  ROLE.DOCTOR, ROLE.POLICE, ROLE.CITIZEN, ROLE.CITIZEN,
];

/** 객체 안의 모든 문자열 값을 재귀적으로 모은다. 키 이름은 포함하지 않는다. */
function allStrings(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) for (const v of value) allStrings(v, out);
  else if (value && typeof value === 'object') for (const v of Object.values(value)) allStrings(v, out);
  return out;
}

describe('viewFor — 정보 누출', () => {
  it('시민 뷰에는 다른 사람의 역할이 단 하나도 없다', () => {
    const room = makeRoom(SEVEN, { phase: PHASE.DAY_DISCUSSION });
    const view = viewFor(room, idOf(room, ROLE.CITIZEN, 0));
    const strings = allStrings(view);

    // 남의 역할은 어떤 형태로도 새면 안 된다.
    expect(strings).not.toContain(ROLE.MAFIA);
    expect(strings).not.toContain(ROLE.SPY);
    expect(strings).not.toContain(ROLE.DOCTOR);
    expect(strings).not.toContain(ROLE.POLICE);
    // 내 역할은 정확히 한 번만 나온다 (me.role).
    expect(strings.filter((s) => s === ROLE.CITIZEN)).toHaveLength(1);
  });

  it('players 배열에는 role 필드 자체가 없다', () => {
    const room = makeRoom(SEVEN, { phase: PHASE.DAY_DISCUSSION });
    const view = viewFor(room, 'p1');
    for (const p of view.players) {
      expect(p).not.toHaveProperty('role');
    }
  });

  it('setTimeout 핸들 같은 내부 필드가 새지 않는다', () => {
    const room = makeRoom(SEVEN, { phase: PHASE.DAY_DISCUSSION });
    room.timer = setTimeout(() => {}, 10_000);
    const view = viewFor(room, 'p1');
    expect(view).not.toHaveProperty('timer');
    clearTimeout(room.timer);
  });

  it('시민 뷰에는 마피아의 밤 지목이 없다', () => {
    const room = makeRoom(SEVEN, { phase: PHASE.NIGHT });
    submitNightAction(room, idOf(room, ROLE.MAFIA, 0), {
      type: ACTION.MAFIA_KILL, targetId: idOf(room, ROLE.CITIZEN, 0),
    });
    expect(viewFor(room, idOf(room, ROLE.CITIZEN, 1)).nightPicks).toEqual([]);
  });

  it('시민 뷰에는 경찰 조사 결과가 없다', () => {
    const room = makeRoom(SEVEN, { phase: PHASE.DAY_DISCUSSION });
    room.policeResults = [{ day: 1, targetId: 'p1', isMafia: true }];
    expect(viewFor(room, idOf(room, ROLE.CITIZEN)).me.investigations).toEqual([]);
  });

  it('시민 뷰에는 스파이가 알아낸 직업이 없다', () => {
    const room = makeRoom(SEVEN, { phase: PHASE.DAY_DISCUSSION });
    room.spyKnownJobs = { p4: ROLE.DOCTOR };
    expect(viewFor(room, idOf(room, ROLE.CITIZEN)).me.knownJobs).toEqual([]);
  });

  it('경찰 뷰에도 다른 사람의 역할은 없다', () => {
    const room = makeRoom(SEVEN, { phase: PHASE.DAY_DISCUSSION });
    room.policeResults = [{ day: 1, targetId: idOf(room, ROLE.MAFIA), isMafia: true }];
    const strings = allStrings(viewFor(room, idOf(room, ROLE.POLICE)));
    // 조사 결과는 isMafia 불리언으로만 나가고 역할 문자열로 나가지 않는다.
    expect(strings).not.toContain(ROLE.MAFIA);
    expect(strings).not.toContain(ROLE.DOCTOR);
  });

  it('스파이 뷰에는 이미 확인한 직업만 있고 나머지는 없다', () => {
    const room = makeRoom(SEVEN, { phase: PHASE.NIGHT });
    const doctorId = idOf(room, ROLE.DOCTOR);
    submitNightAction(room, idOf(room, ROLE.SPY), {
      type: ACTION.SPY_CONTACT, targetId: doctorId,
    });
    const view = viewFor(room, idOf(room, ROLE.SPY));
    expect(view.me.knownJobs).toEqual([{ targetId: doctorId, role: ROLE.DOCTOR }]);
    // 확인하지 않은 경찰의 직업은 어디에도 없어야 한다.
    expect(allStrings(view)).not.toContain(ROLE.POLICE);
  });
});

describe('viewFor — 마피아 팀', () => {
  it('마피아는 동료 id를 안다', () => {
    const room = makeRoom(SEVEN, { phase: PHASE.NIGHT });
    const [m0, m1] = [idOf(room, ROLE.MAFIA, 0), idOf(room, ROLE.MAFIA, 1)];
    expect(viewFor(room, m0).me.teammates).toEqual([m1]);
  });

  it('시민의 teammates는 비어 있다', () => {
    const room = makeRoom(SEVEN, { phase: PHASE.NIGHT });
    expect(viewFor(room, idOf(room, ROLE.CITIZEN)).me.teammates).toEqual([]);
  });

  it('접선 전 스파이의 teammates는 비어 있다', () => {
    const room = makeRoom(SEVEN, { phase: PHASE.NIGHT });
    expect(viewFor(room, idOf(room, ROLE.SPY)).me.teammates).toEqual([]);
  });

  it('접선한 스파이는 마피아 동료를 알게 된다', () => {
    const room = makeRoom(SEVEN, { phase: PHASE.NIGHT });
    submitNightAction(room, idOf(room, ROLE.SPY), {
      type: ACTION.SPY_CONTACT, targetId: idOf(room, ROLE.MAFIA, 0),
    });
    const view = viewFor(room, idOf(room, ROLE.SPY));
    expect(view.me.contactSucceeded).toBe(true);
    expect(view.me.teammates.sort()).toEqual(
      [idOf(room, ROLE.MAFIA, 0), idOf(room, ROLE.MAFIA, 1)].sort(),
    );
  });

  it('접선 후 마피아도 스파이를 동료로 보게 된다', () => {
    const room = makeRoom(SEVEN, { phase: PHASE.NIGHT });
    submitNightAction(room, idOf(room, ROLE.SPY), {
      type: ACTION.SPY_CONTACT, targetId: idOf(room, ROLE.MAFIA, 0),
    });
    expect(viewFor(room, idOf(room, ROLE.MAFIA, 0)).me.teammates)
      .toContain(idOf(room, ROLE.SPY));
  });

  it('마피아는 밤에 서로의 지목 현황을 본다', () => {
    const room = makeRoom(SEVEN, { phase: PHASE.NIGHT });
    const m0 = idOf(room, ROLE.MAFIA, 0);
    const victim = idOf(room, ROLE.CITIZEN, 0);
    submitNightAction(room, m0, { type: ACTION.MAFIA_KILL, targetId: victim });
    expect(viewFor(room, idOf(room, ROLE.MAFIA, 1)).nightPicks)
      .toEqual([{ actorId: m0, targetId: victim }]);
  });

  it('낮에는 지목 현황이 비워진다', () => {
    const room = makeRoom(SEVEN, { phase: PHASE.NIGHT });
    submitNightAction(room, idOf(room, ROLE.MAFIA, 0), {
      type: ACTION.MAFIA_KILL, targetId: idOf(room, ROLE.CITIZEN, 0),
    });
    room.phase = PHASE.DAY_DISCUSSION;
    expect(viewFor(room, idOf(room, ROLE.MAFIA, 1)).nightPicks).toEqual([]);
  });
});

describe('viewFor — 공개 정보', () => {
  it('살아있는 사람의 진영은 공개되지 않는다', () => {
    const room = makeRoom(SEVEN, { phase: PHASE.DAY_DISCUSSION });
    const view = viewFor(room, 'p1');
    expect(view.players.every((p) => p.revealedTeam === null)).toBe(true);
  });

  it('죽은 사람의 진영은 전원에게 공개된다', () => {
    const room = makeRoom(SEVEN, { phase: PHASE.DAY_DISCUSSION });
    const mafiaId = idOf(room, ROLE.MAFIA, 0);
    killPlayer(room, mafiaId);
    const view = viewFor(room, idOf(room, ROLE.CITIZEN));
    expect(view.players.find((p) => p.id === mafiaId).revealedTeam).toBe('MAFIA');
  });

  it('죽은 의사는 시민으로 공개된다', () => {
    const room = makeRoom(SEVEN, { phase: PHASE.DAY_DISCUSSION });
    const doctorId = idOf(room, ROLE.DOCTOR);
    killPlayer(room, doctorId);
    const view = viewFor(room, idOf(room, ROLE.CITIZEN));
    expect(view.players.find((p) => p.id === doctorId).revealedTeam).toBe('CITIZEN');
  });

  it('지목 투표 현황은 전원에게 공개된다', () => {
    const room = makeRoom(SEVEN, { phase: PHASE.VOTE_NOMINATE });
    submitNominate(room, 'p1', 'p4');
    expect(viewFor(room, 'p7').votes).toEqual({ p1: 'p4' });
  });

  it('투표 페이즈가 아니면 투표 현황이 비어 있다', () => {
    const room = makeRoom(SEVEN, { phase: PHASE.VOTE_NOMINATE });
    submitNominate(room, 'p1', 'p4');
    room.phase = PHASE.NIGHT;
    expect(viewFor(room, 'p7').votes).toEqual({});
  });

  it('게임이 끝나면 전원의 역할이 공개된다', () => {
    const room = makeRoom(SEVEN, { phase: PHASE.ENDED });
    room.result = {
      winner: 'CITIZEN',
      roles: room.players.map((p) => ({ id: p.id, role: p.role })),
    };
    const view = viewFor(room, idOf(room, ROLE.CITIZEN));
    expect(view.result.roles).toHaveLength(7);
    expect(view.result.winner).toBe('CITIZEN');
  });

  it('방장 여부가 표시된다', () => {
    const room = makeRoom(SEVEN, { phase: PHASE.WAITING });
    const view = viewFor(room, 'p2');
    expect(view.players.find((p) => p.id === 'p1').isHost).toBe(true);
    expect(view.players.find((p) => p.id === 'p2').isHost).toBe(false);
  });
});

describe('viewFor — 내 행동', () => {
  it('내가 고른 밤 행동이 돌아온다', () => {
    const room = makeRoom(SEVEN, { phase: PHASE.NIGHT });
    const doctorId = idOf(room, ROLE.DOCTOR);
    const targetId = idOf(room, ROLE.CITIZEN, 0);
    submitNightAction(room, doctorId, { type: ACTION.DOCTOR_SAVE, targetId });
    expect(viewFor(room, doctorId).myAction).toEqual({ type: ACTION.DOCTOR_SAVE, targetId });
  });

  it('아직 고르지 않았으면 null이다', () => {
    const room = makeRoom(SEVEN, { phase: PHASE.NIGHT });
    expect(viewFor(room, idOf(room, ROLE.DOCTOR)).myAction).toBeNull();
  });

  it('시민은 밤 행동이 없다', () => {
    const room = makeRoom(SEVEN, { phase: PHASE.NIGHT });
    expect(viewFor(room, idOf(room, ROLE.CITIZEN)).myAction).toBeNull();
  });
});
