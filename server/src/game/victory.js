import { ROLE, PHASE } from './roles.js';
import { alivePlayers, setPhase } from './state.js';

/**
 * 승자를 판정한다. 스파이는 마피아로 세지 않는다 —
 * 마피아로 세면 7명 판에서 첫 밤에 게임이 끝나버린다.
 */
export function checkVictory(room) {
  const alive = alivePlayers(room);
  const mafiaCount = alive.filter((p) => p.role === ROLE.MAFIA).length;
  const otherCount = alive.length - mafiaCount;
  if (mafiaCount === 0) return 'CITIZEN';
  if (mafiaCount >= otherCount) return 'MAFIA';
  return null;
}

export function checkAndSetVictory(room, now = 0) {
  const winner = checkVictory(room);
  if (!winner) return null;
  room.result = {
    winner,
    roles: room.players.map((p) => ({ id: p.id, role: p.role })),
  };
  setPhase(room, PHASE.ENDED, now);
  return winner;
}
