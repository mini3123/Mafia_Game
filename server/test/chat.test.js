import { describe, it, expect } from 'vitest';
import { ROLE, PHASE } from '../src/game/roles.js';
import { killPlayer } from '../src/game/state.js';
import { CHANNEL, canSend, recipientsOf, availableChannels } from '../src/game/chat.js';
import { makeRoom, idOf } from './helpers.js';

const SEVEN = [
  ROLE.MAFIA, ROLE.MAFIA, ROLE.SPY,
  ROLE.DOCTOR, ROLE.POLICE, ROLE.CITIZEN, ROLE.CITIZEN,
];

describe('canSend — PUBLIC', () => {
  it('낮 토론에는 살아있는 사람이 말할 수 있다', () => {
    const room = makeRoom(SEVEN, { phase: PHASE.DAY_DISCUSSION });
    expect(canSend(room, 'p1', CHANNEL.PUBLIC)).toBe(true);
  });

  it('지목 투표 중에도 말할 수 있다', () => {
    const room = makeRoom(SEVEN, { phase: PHASE.VOTE_NOMINATE });
    expect(canSend(room, 'p1', CHANNEL.PUBLIC)).toBe(true);
  });

  it('밤에는 막힌다', () => {
    const room = makeRoom(SEVEN, { phase: PHASE.NIGHT });
    expect(canSend(room, 'p1', CHANNEL.PUBLIC)).toBe(false);
  });

  it('찬반 투표 중에는 막힌다', () => {
    const room = makeRoom(SEVEN, { phase: PHASE.VOTE_JUDGE });
    expect(canSend(room, 'p1', CHANNEL.PUBLIC)).toBe(false);
  });

  it('최후 변론에는 지목된 사람만 말할 수 있다', () => {
    const room = makeRoom(SEVEN, { phase: PHASE.DEFENSE });
    room.nominee = 'p4';
    expect(canSend(room, 'p4', CHANNEL.PUBLIC)).toBe(true);
    expect(canSend(room, 'p1', CHANNEL.PUBLIC)).toBe(false);
  });

  it('죽은 사람은 전체 채팅에 말할 수 없다', () => {
    const room = makeRoom(SEVEN, { phase: PHASE.DAY_DISCUSSION });
    killPlayer(room, 'p1');
    expect(canSend(room, 'p1', CHANNEL.PUBLIC)).toBe(false);
  });
});

describe('canSend — MAFIA', () => {
  it('밤에 마피아가 말할 수 있다', () => {
    const room = makeRoom(SEVEN, { phase: PHASE.NIGHT });
    expect(canSend(room, idOf(room, ROLE.MAFIA), CHANNEL.MAFIA)).toBe(true);
  });

  it('낮에는 마피아도 막힌다', () => {
    const room = makeRoom(SEVEN, { phase: PHASE.DAY_DISCUSSION });
    expect(canSend(room, idOf(room, ROLE.MAFIA), CHANNEL.MAFIA)).toBe(false);
  });

  it('접선 전 스파이는 말할 수 없다', () => {
    const room = makeRoom(SEVEN, { phase: PHASE.NIGHT });
    expect(canSend(room, idOf(room, ROLE.SPY), CHANNEL.MAFIA)).toBe(false);
  });

  it('접선한 스파이는 말할 수 있다', () => {
    const room = makeRoom(SEVEN, { phase: PHASE.NIGHT });
    room.spyContacted = true;
    expect(canSend(room, idOf(room, ROLE.SPY), CHANNEL.MAFIA)).toBe(true);
  });

  it('시민은 말할 수 없다', () => {
    const room = makeRoom(SEVEN, { phase: PHASE.NIGHT });
    expect(canSend(room, idOf(room, ROLE.CITIZEN), CHANNEL.MAFIA)).toBe(false);
  });

  it('죽은 마피아는 말할 수 없다', () => {
    const room = makeRoom(SEVEN, { phase: PHASE.NIGHT });
    const mafiaId = idOf(room, ROLE.MAFIA);
    killPlayer(room, mafiaId);
    expect(canSend(room, mafiaId, CHANNEL.MAFIA)).toBe(false);
  });
});

describe('canSend — GHOST', () => {
  it('죽은 사람은 어느 페이즈에서든 말할 수 있다', () => {
    for (const phase of [PHASE.NIGHT, PHASE.DAY_DISCUSSION, PHASE.VOTE_JUDGE, PHASE.DEFENSE]) {
      const room = makeRoom(SEVEN, { phase });
      killPlayer(room, 'p1');
      expect(canSend(room, 'p1', CHANNEL.GHOST)).toBe(true);
    }
  });

  it('살아있는 사람은 유령 채팅에 말할 수 없다', () => {
    const room = makeRoom(SEVEN, { phase: PHASE.DAY_DISCUSSION });
    expect(canSend(room, 'p1', CHANNEL.GHOST)).toBe(false);
  });
});

describe('recipientsOf', () => {
  it('전체 채팅은 죽은 사람을 포함해 전원이 받는다', () => {
    const room = makeRoom(SEVEN, { phase: PHASE.DAY_DISCUSSION });
    killPlayer(room, 'p1');
    expect(recipientsOf(room, CHANNEL.PUBLIC)).toHaveLength(7);
  });

  it('유령 채팅은 죽은 사람만 받는다', () => {
    const room = makeRoom(SEVEN, { phase: PHASE.DAY_DISCUSSION });
    killPlayer(room, 'p1');
    killPlayer(room, 'p2');
    expect(recipientsOf(room, CHANNEL.GHOST).sort()).toEqual(['p1', 'p2']);
  });

  it('살아있는 사람은 유령 메시지를 받지 않는다', () => {
    const room = makeRoom(SEVEN, { phase: PHASE.DAY_DISCUSSION });
    killPlayer(room, 'p1');
    expect(recipientsOf(room, CHANNEL.GHOST)).not.toContain('p2');
  });

  it('마피아 채팅은 살아있는 마피아만 받는다', () => {
    const room = makeRoom(SEVEN, { phase: PHASE.NIGHT });
    const mafiaIds = room.players.filter((p) => p.role === ROLE.MAFIA).map((p) => p.id);
    expect(recipientsOf(room, CHANNEL.MAFIA).sort()).toEqual(mafiaIds.sort());
  });

  it('접선한 스파이는 마피아 메시지를 받는다', () => {
    const room = makeRoom(SEVEN, { phase: PHASE.NIGHT });
    room.spyContacted = true;
    expect(recipientsOf(room, CHANNEL.MAFIA)).toContain(idOf(room, ROLE.SPY));
  });

  it('죽은 마피아는 마피아 메시지를 받지 않는다', () => {
    const room = makeRoom(SEVEN, { phase: PHASE.NIGHT });
    const mafiaId = idOf(room, ROLE.MAFIA, 0);
    killPlayer(room, mafiaId);
    expect(recipientsOf(room, CHANNEL.MAFIA)).not.toContain(mafiaId);
  });
});

describe('availableChannels', () => {
  it('살아있는 시민은 전체 채팅만 본다', () => {
    const room = makeRoom(SEVEN, { phase: PHASE.DAY_DISCUSSION });
    expect(availableChannels(room, idOf(room, ROLE.CITIZEN))).toEqual([CHANNEL.PUBLIC]);
  });

  it('밤의 마피아는 전체와 마피아 채널을 본다', () => {
    const room = makeRoom(SEVEN, { phase: PHASE.NIGHT });
    expect(availableChannels(room, idOf(room, ROLE.MAFIA)))
      .toEqual([CHANNEL.PUBLIC, CHANNEL.MAFIA]);
  });

  it('죽은 사람은 전체와 유령 채널을 본다', () => {
    const room = makeRoom(SEVEN, { phase: PHASE.DAY_DISCUSSION });
    killPlayer(room, 'p1');
    expect(availableChannels(room, 'p1')).toEqual([CHANNEL.PUBLIC, CHANNEL.GHOST]);
  });

  it('살아있는 사람 목록에는 유령 채널이 없다', () => {
    const room = makeRoom(SEVEN, { phase: PHASE.DAY_DISCUSSION });
    expect(availableChannels(room, 'p1')).not.toContain(CHANNEL.GHOST);
  });
});
