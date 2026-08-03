import { describe, it, expect } from 'vitest';
import { PHASE } from '../src/game/roles.js';
import { playerById } from '../src/game/state.js';
import {
  createRegistry, generateCode, createNewRoom, joinRoom,
  rejoinRoom, leaveRoom, disconnectRoom, sweepEmptyRooms, EMPTY_ROOM_TTL_MS,
} from '../src/rooms.js';
import { makeRng } from './helpers.js';

/** 방을 만들고 인원을 채운다. 방장 포함 count명. */
function roomWith(count) {
  const registry = createRegistry();
  const created = createNewRoom(registry, '방장');
  for (let i = 2; i <= count; i++) {
    joinRoom(registry, created.room.code, `사람${i}`);
  }
  return {
    registry,
    room: created.room,
    hostId: created.playerId,
    hostToken: created.resumeToken,
  };
}

describe('generateCode', () => {
  it('6자리다', () => {
    expect(generateCode(makeRng(7))).toHaveLength(6);
  });

  it('혼동되는 0 O 1 I를 쓰지 않는다', () => {
    for (let seed = 1; seed <= 200; seed++) {
      expect(generateCode(makeRng(seed))).not.toMatch(/[01OI]/);
    }
  });

  it('영숫자 대문자만 쓴다', () => {
    for (let seed = 1; seed <= 200; seed++) {
      expect(generateCode(makeRng(seed))).toMatch(/^[A-Z2-9]{6}$/);
    }
  });
});

describe('createNewRoom', () => {
  it('만든 사람이 방장이 되고 첫 참가자가 된다', () => {
    const registry = createRegistry();
    const { ok, room, playerId, resumeToken } = createNewRoom(registry, '방장');
    expect(ok).toBe(true);
    expect(room.hostId).toBe(playerId);
    expect(room.players).toHaveLength(1);
    expect(room.players[0].nickname).toBe('방장');
    expect(room.phase).toBe(PHASE.WAITING);
    expect(resumeToken).toBeTruthy();
    expect(resumeToken).not.toBe(playerId);
  });

  it('레지스트리에 코드로 등록된다', () => {
    const registry = createRegistry();
    const { room } = createNewRoom(registry, '방장');
    expect(registry.rooms.get(room.code)).toBe(room);
  });

  it('이미 쓰는 코드는 피해서 뽑는다', () => {
    const registry = createRegistry();
    const first = createNewRoom(registry, '가').room;
    const second = createNewRoom(registry, '나').room;
    expect(second.code).not.toBe(first.code);
  });

  it('빈 닉네임을 거부한다', () => {
    const registry = createRegistry();
    expect(createNewRoom(registry, '   ')).toEqual({ ok: false, code: 'INVALID_NICKNAME' });
  });

  it('12자를 넘는 닉네임을 거부한다', () => {
    const registry = createRegistry();
    expect(createNewRoom(registry, '가'.repeat(13))).toEqual({ ok: false, code: 'INVALID_NICKNAME' });
  });
});

describe('joinRoom', () => {
  it('참가자가 늘어난다', () => {
    const { registry, room } = roomWith(1);
    const result = joinRoom(registry, room.code, '손님');
    expect(result.ok).toBe(true);
    expect(room.players).toHaveLength(2);
  });

  it('없는 코드를 거부한다', () => {
    const registry = createRegistry();
    expect(joinRoom(registry, 'ZZZZZZ', '손님')).toEqual({ ok: false, code: 'ROOM_NOT_FOUND' });
  });

  it('코드는 대소문자를 가리지 않는다', () => {
    const { registry, room } = roomWith(1);
    expect(joinRoom(registry, room.code.toLowerCase(), '손님').ok).toBe(true);
  });

  it('같은 닉네임을 거부한다', () => {
    const { registry, room } = roomWith(1);
    expect(joinRoom(registry, room.code, '방장')).toEqual({ ok: false, code: 'NICKNAME_TAKEN' });
  });

  it('12명이 차면 더 못 들어온다', () => {
    const { registry, room } = roomWith(12);
    expect(joinRoom(registry, room.code, '열세번째')).toEqual({ ok: false, code: 'ROOM_FULL' });
  });

  it('게임이 진행 중이면 못 들어온다', () => {
    const { registry, room } = roomWith(7);
    room.phase = PHASE.NIGHT;
    expect(joinRoom(registry, room.code, '난입')).toEqual({ ok: false, code: 'GAME_IN_PROGRESS' });
  });
});

describe('rejoinRoom', () => {
  it('토큰으로 원래 자리에 다시 붙는다', () => {
    const { registry, room, hostId, hostToken } = roomWith(5);
    room.phase = PHASE.NIGHT;
    leaveRoom(registry, room.code, hostId, { now: 0 });
    const result = rejoinRoom(registry, room.code, hostToken);
    expect(result.ok).toBe(true);
    expect(playerById(room, hostId).connected).toBe(true);
  });

  it('게임 중에도 재입장할 수 있다', () => {
    const { registry, room } = roomWith(5);
    room.phase = PHASE.DAY_DISCUSSION;
    const joinerId = room.players[1].id;
    const joinerToken = room.players[1].resumeToken;
    leaveRoom(registry, room.code, joinerId, { now: 0 });
    expect(rejoinRoom(registry, room.code, joinerToken).ok).toBe(true);
  });

  it('공개 플레이어 id로는 다른 자리에 재입장할 수 없다', () => {
    const { registry, room, hostId } = roomWith(5);
    expect(rejoinRoom(registry, room.code, hostId))
      .toEqual({ ok: false, code: 'PLAYER_NOT_FOUND' });
  });

  it('모르는 토큰을 거부한다', () => {
    const { registry, room } = roomWith(5);
    expect(rejoinRoom(registry, room.code, 'nobody')).toEqual({ ok: false, code: 'PLAYER_NOT_FOUND' });
  });

  it('없는 방을 거부한다', () => {
    const registry = createRegistry();
    expect(rejoinRoom(registry, 'ZZZZZZ', 'p1')).toEqual({ ok: false, code: 'ROOM_NOT_FOUND' });
  });
});

describe('disconnectRoom — 일시적인 연결 끊김', () => {
  it('대기실에서도 자리를 남겨 새로고침으로 돌아올 수 있다', () => {
    const { registry, room, hostId, hostToken } = roomWith(3);
    disconnectRoom(registry, room.code, hostId, { now: 1000 });
    expect(playerById(room, hostId).connected).toBe(false);
    expect(rejoinRoom(registry, room.code, hostToken).ok).toBe(true);
  });

  it('교체된 옛 소켓의 늦은 disconnect는 새 연결을 끊지 않는다', () => {
    const { registry, room, hostId } = roomWith(3);
    const player = playerById(room, hostId);
    player.socketId = 'new-socket';
    disconnectRoom(registry, room.code, hostId, {
      now: 1000,
      expectedSocketId: 'old-socket',
    });
    expect(player.connected).toBe(true);
    expect(player.socketId).toBe('new-socket');
  });
});

describe('leaveRoom — 대기 중', () => {
  it('자리가 아예 사라진다', () => {
    const { registry, room } = roomWith(3);
    const leaverId = room.players[2].id;
    leaveRoom(registry, room.code, leaverId, { now: 0 });
    expect(room.players).toHaveLength(2);
    expect(playerById(room, leaverId)).toBeUndefined();
  });

  it('방장이 나가면 다음 사람이 승계한다', () => {
    const { registry, room, hostId } = roomWith(3);
    const nextId = room.players[1].id;
    leaveRoom(registry, room.code, hostId, { now: 0 });
    expect(room.hostId).toBe(nextId);
  });
});

describe('leaveRoom — 게임 중', () => {
  it('자리는 남고 연결만 끊긴 것으로 표시된다', () => {
    const { registry, room } = roomWith(5);
    room.phase = PHASE.NIGHT;
    const leaverId = room.players[2].id;
    leaveRoom(registry, room.code, leaverId, { now: 0 });
    expect(room.players).toHaveLength(5);
    expect(playerById(room, leaverId).connected).toBe(false);
    expect(playerById(room, leaverId).alive).toBe(true);
  });

  it('방장이 끊기면 연결된 다음 사람이 승계한다', () => {
    const { registry, room, hostId } = roomWith(5);
    room.phase = PHASE.NIGHT;
    const nextId = room.players[1].id;
    leaveRoom(registry, room.code, hostId, { now: 0 });
    expect(room.hostId).toBe(nextId);
  });
});

describe('빈 방 정리', () => {
  it('마지막 사람이 나가면 빈 시각이 기록된다', () => {
    const { registry, room, hostId } = roomWith(1);
    leaveRoom(registry, room.code, hostId, { now: 1000 });
    expect(room.emptySince).toBe(1000);
  });

  it('누가 남아 있으면 빈 시각이 없다', () => {
    const { registry, room, hostId } = roomWith(3);
    leaveRoom(registry, room.code, hostId, { now: 1000 });
    expect(room.emptySince).toBeNull();
  });

  it('유예 시간이 지나면 방이 삭제된다', () => {
    const { registry, room, hostId } = roomWith(1);
    leaveRoom(registry, room.code, hostId, { now: 1000 });
    const removed = sweepEmptyRooms(registry, { now: 1000 + EMPTY_ROOM_TTL_MS + 1 });
    expect(removed).toEqual([room.code]);
    expect(registry.rooms.has(room.code)).toBe(false);
  });

  it('유예 시간 안에는 남아 있는다', () => {
    const { registry, room, hostId } = roomWith(1);
    leaveRoom(registry, room.code, hostId, { now: 1000 });
    expect(sweepEmptyRooms(registry, { now: 1000 + EMPTY_ROOM_TTL_MS - 1 })).toEqual([]);
    expect(registry.rooms.has(room.code)).toBe(true);
  });

  it('누가 다시 들어오면 빈 시각이 지워진다', () => {
    const { registry, room, hostId } = roomWith(1);
    leaveRoom(registry, room.code, hostId, { now: 1000 });
    joinRoom(registry, room.code, '새사람');
    expect(room.emptySince).toBeNull();
    expect(sweepEmptyRooms(registry, { now: 1000 + EMPTY_ROOM_TTL_MS + 1 })).toEqual([]);
  });

  it('게임 중 전원이 끊겨도 유예 후 삭제된다', () => {
    const { registry, room } = roomWith(5);
    room.phase = PHASE.NIGHT;
    for (const p of [...room.players]) leaveRoom(registry, room.code, p.id, { now: 1000 });
    expect(room.emptySince).toBe(1000);
    expect(sweepEmptyRooms(registry, { now: 1000 + EMPTY_ROOM_TTL_MS + 1 })).toEqual([room.code]);
  });
});
