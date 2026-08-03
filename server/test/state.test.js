import { describe, it, expect } from 'vitest';
import { ROLE, PHASE } from '../src/game/roles.js';
import {
  createRoom, addPlayerToRoom, startGame,
  playerById, alivePlayers, mafiaTeamIds, killPlayer, setPhase,
} from '../src/game/state.js';

function roomWith(count) {
  const room = createRoom('ABCDEF', 'p1');
  for (let i = 1; i <= count; i++) {
    addPlayerToRoom(room, { id: `p${i}`, nickname: `사람${i}` });
  }
  return room;
}

describe('createRoom', () => {
  it('대기 상태로 시작하고 참가자가 없다', () => {
    const room = createRoom('ABCDEF', 'p1');
    expect(room.phase).toBe(PHASE.WAITING);
    expect(room.day).toBe(0);
    expect(room.players).toEqual([]);
    expect(room.result).toBeNull();
  });
});

describe('startGame', () => {
  it('첫 밤으로 시작하고 날짜가 1이 된다', () => {
    const room = roomWith(7);
    startGame(room, { now: 1000, rng: () => 0.5 });
    expect(room.phase).toBe(PHASE.NIGHT);
    expect(room.day).toBe(1);
    expect(room.phaseEndsAt).toBe(1000 + 30_000);
  });

  it('전원에게 역할이 배정된다', () => {
    const room = roomWith(7);
    startGame(room, { now: 0, rng: () => 0.5 });
    for (const p of room.players) {
      expect(Object.values(ROLE)).toContain(p.role);
    }
  });

  it('5명 미만이면 던진다', () => {
    const room = roomWith(4);
    expect(() => startGame(room, { now: 0 })).toThrow();
  });
});

describe('killPlayer', () => {
  it('마피아가 죽으면 진영이 MAFIA로 공개된다', () => {
    const room = roomWith(7);
    startGame(room, { now: 0, rng: () => 0.5 });
    const mafia = room.players.find((p) => p.role === ROLE.MAFIA);
    killPlayer(room, mafia.id);
    expect(mafia.alive).toBe(false);
    expect(mafia.revealedTeam).toBe('MAFIA');
  });

  it('의사·경찰·스파이가 죽으면 모두 CITIZEN으로 공개된다', () => {
    const room = roomWith(7);
    startGame(room, { now: 0, rng: () => 0.5 });
    for (const role of [ROLE.DOCTOR, ROLE.POLICE, ROLE.SPY]) {
      const target = room.players.find((p) => p.role === role);
      killPlayer(room, target.id);
      expect(target.revealedTeam).toBe('CITIZEN');
    }
  });
});

describe('mafiaTeamIds', () => {
  it('접선 전에는 마피아만 포함한다', () => {
    const room = roomWith(7);
    startGame(room, { now: 0, rng: () => 0.5 });
    const mafiaIds = room.players.filter((p) => p.role === ROLE.MAFIA).map((p) => p.id);
    expect(mafiaTeamIds(room).sort()).toEqual(mafiaIds.sort());
  });

  it('접선 성공 후에는 스파이도 포함한다', () => {
    const room = roomWith(7);
    startGame(room, { now: 0, rng: () => 0.5 });
    room.spyContacted = true;
    const spy = room.players.find((p) => p.role === ROLE.SPY);
    expect(mafiaTeamIds(room)).toContain(spy.id);
  });
});

describe('alivePlayers / playerById / setPhase', () => {
  it('죽은 사람은 생존자 목록에서 빠진다', () => {
    const room = roomWith(7);
    startGame(room, { now: 0, rng: () => 0.5 });
    killPlayer(room, 'p3');
    expect(alivePlayers(room)).toHaveLength(6);
    expect(playerById(room, 'p3').alive).toBe(false);
  });

  it('setPhase가 페이즈 종료 시각을 절대 시각으로 설정한다', () => {
    const room = roomWith(7);
    setPhase(room, PHASE.DAY_DISCUSSION, 5000);
    expect(room.phase).toBe(PHASE.DAY_DISCUSSION);
    expect(room.phaseEndsAt).toBe(5000 + 120_000);
  });

  it('ENDED에는 종료 시각이 없다', () => {
    const room = roomWith(7);
    setPhase(room, PHASE.ENDED, 5000);
    expect(room.phaseEndsAt).toBeNull();
  });
});
