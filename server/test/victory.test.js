import { describe, it, expect } from 'vitest';
import { ROLE, PHASE } from '../src/game/roles.js';
import { killPlayer } from '../src/game/state.js';
import { checkVictory, checkAndSetVictory } from '../src/game/victory.js';
import { makeRoom, idOf } from './helpers.js';

const SEVEN = [
  ROLE.MAFIA, ROLE.MAFIA, ROLE.SPY,
  ROLE.DOCTOR, ROLE.POLICE, ROLE.CITIZEN, ROLE.CITIZEN,
];

describe('checkVictory', () => {
  it('게임 시작 직후에는 승자가 없다', () => {
    expect(checkVictory(makeRoom(SEVEN))).toBeNull();
  });

  it('마피아가 전멸하면 시민 승리', () => {
    const room = makeRoom(SEVEN);
    killPlayer(room, idOf(room, ROLE.MAFIA, 0));
    killPlayer(room, idOf(room, ROLE.MAFIA, 1));
    expect(checkVictory(room)).toBe('CITIZEN');
  });

  it('마피아 2 · 그 외 2면 마피아 승리', () => {
    const room = makeRoom(SEVEN);
    killPlayer(room, idOf(room, ROLE.DOCTOR));
    killPlayer(room, idOf(room, ROLE.POLICE));
    killPlayer(room, idOf(room, ROLE.CITIZEN, 0));
    // 남은 사람: 마피아 2, 스파이 1, 시민 1 → 2 >= 2
    expect(checkVictory(room)).toBe('MAFIA');
  });

  it('마피아 2 · 그 외 3이면 게임이 계속된다', () => {
    const room = makeRoom(SEVEN);
    killPlayer(room, idOf(room, ROLE.DOCTOR));
    killPlayer(room, idOf(room, ROLE.POLICE));
    // 남은 사람: 마피아 2, 스파이 1, 시민 2 → 2 < 3
    expect(checkVictory(room)).toBeNull();
  });

  it('스파이는 마피아로 세지 않는다', () => {
    // 마피아 1 · 스파이 1 · 시민 1. 스파이를 마피아로 세면 2 >= 1이라 마피아 승이 되어버린다.
    const room = makeRoom([ROLE.MAFIA, ROLE.SPY, ROLE.CITIZEN]);
    expect(checkVictory(room)).toBeNull();
  });

  it('마피아가 전멸하면 스파이가 살아있어도 시민 승리', () => {
    const room = makeRoom([ROLE.MAFIA, ROLE.SPY, ROLE.CITIZEN, ROLE.CITIZEN]);
    killPlayer(room, idOf(room, ROLE.MAFIA));
    expect(checkVictory(room)).toBe('CITIZEN');
  });
});

describe('checkAndSetVictory', () => {
  it('승자가 나오면 결과를 채우고 ENDED로 바꾼다', () => {
    const room = makeRoom(SEVEN);
    killPlayer(room, idOf(room, ROLE.MAFIA, 0));
    killPlayer(room, idOf(room, ROLE.MAFIA, 1));
    checkAndSetVictory(room, 0);
    expect(room.result.winner).toBe('CITIZEN');
    expect(room.phase).toBe(PHASE.ENDED);
    expect(room.phaseEndsAt).toBeNull();
  });

  it('결과에 전원의 정확한 역할이 담긴다', () => {
    const room = makeRoom(SEVEN);
    killPlayer(room, idOf(room, ROLE.MAFIA, 0));
    killPlayer(room, idOf(room, ROLE.MAFIA, 1));
    checkAndSetVictory(room, 0);
    expect(room.result.roles).toHaveLength(7);
    expect(room.result.roles).toContainEqual({ id: idOf(room, ROLE.SPY), role: ROLE.SPY });
  });

  it('승자가 없으면 아무것도 바꾸지 않는다', () => {
    const room = makeRoom(SEVEN);
    checkAndSetVictory(room, 0);
    expect(room.result).toBeNull();
    expect(room.phase).toBe(PHASE.NIGHT);
  });
});
