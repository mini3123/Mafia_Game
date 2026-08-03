import { PHASE } from '../src/game/roles.js';
import { createRoom, addPlayerToRoom, setPhase } from '../src/game/state.js';

/**
 * 역할을 직접 지정해 방을 만든다. 테스트에서 특정 배치를 재현할 때 쓴다.
 * 예: makeRoom(['MAFIA', 'MAFIA', 'SPY', 'DOCTOR', 'POLICE', 'CITIZEN', 'CITIZEN'])
 * 플레이어 id는 p1..pN, 닉네임은 사람1..사람N이 된다.
 */
export function makeRoom(roles, { phase = PHASE.NIGHT, day = 1, now = 0 } = {}) {
  const room = createRoom('TESTAB', 'p1');
  roles.forEach((role, index) => {
    const id = `p${index + 1}`;
    addPlayerToRoom(room, { id, nickname: `사람${index + 1}` });
    room.players[index].role = role;
  });
  room.day = day;
  setPhase(room, phase, now);
  return room;
}

/** 역할로 플레이어 id를 찾는다. 같은 역할이 여럿이면 index로 고른다. */
export function idOf(room, role, index = 0) {
  return room.players.filter((p) => p.role === role)[index].id;
}

/** 결정적 난수 생성기. 같은 seed면 같은 수열을 낸다. */
export function makeRng(seed) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}
