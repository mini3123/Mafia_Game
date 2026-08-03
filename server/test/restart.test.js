import { describe, it, expect } from 'vitest';
import { ROLE, PHASE } from '../src/game/roles.js';
import { killPlayer, resetToWaiting } from '../src/game/state.js';
import { checkAndSetVictory } from '../src/game/victory.js';
import { makeRoom, idOf } from './helpers.js';

const FIVE = [ROLE.MAFIA, ROLE.DOCTOR, ROLE.POLICE, ROLE.CITIZEN, ROLE.CITIZEN];

function endedRoom() {
  const room = makeRoom(FIVE, { phase: PHASE.NIGHT, day: 3 });
  killPlayer(room, idOf(room, ROLE.MAFIA));
  checkAndSetVictory(room, 0);
  return room;
}

describe('resetToWaiting', () => {
  it('대기 상태로 돌아간다', () => {
    const room = endedRoom();
    resetToWaiting(room);
    expect(room.phase).toBe(PHASE.WAITING);
    expect(room.day).toBe(0);
    expect(room.phaseEndsAt).toBeNull();
    expect(room.result).toBeNull();
  });

  it('전원이 되살아나고 역할과 공개 진영이 지워진다', () => {
    const room = endedRoom();
    resetToWaiting(room);
    for (const p of room.players) {
      expect(p.alive).toBe(true);
      expect(p.role).toBeNull();
      expect(p.revealedTeam).toBeNull();
    }
  });

  it('지난 판의 흔적이 남지 않는다', () => {
    const room = endedRoom();
    room.spyKnownJobs = { p2: ROLE.DOCTOR };
    room.spyContacted = true;
    room.spyContactedOnDay = 2;
    room.policeResults = [{ day: 1, targetId: 'p2', isMafia: false }];
    room.chatLog = [{ channel: 'PUBLIC', text: '지난 판', recipients: ['p1'] }];

    resetToWaiting(room);

    expect(room.spyKnownJobs).toEqual({});
    expect(room.spyContacted).toBe(false);
    expect(room.spyContactedOnDay).toBeNull();
    expect(room.policeResults).toEqual([]);
    expect(room.chatLog).toEqual([]);
    expect(room.lastNightResult).toBeNull();
    expect(room.lastExecution).toBeNull();
    expect(room.votes).toEqual({});
    expect(room.judgeVotes).toEqual({});
    expect(room.nominee).toBeNull();
  });

  it('참가자와 방장은 그대로 남는다', () => {
    const room = endedRoom();
    const before = room.players.map((p) => p.id);
    resetToWaiting(room);
    expect(room.players.map((p) => p.id)).toEqual(before);
    expect(room.hostId).toBe('p1');
  });

  it('게임 중 나간 참가자는 다음 대기실에서 제거한다', () => {
    const room = endedRoom();
    room.players[4].connected = false;
    const departedId = room.players[4].id;
    resetToWaiting(room);
    expect(room.players.some((player) => player.id === departedId)).toBe(false);
  });

  it('나간 방장 대신 연결된 참가자가 방장이 된다', () => {
    const room = endedRoom();
    room.players[0].connected = false;
    resetToWaiting(room);
    expect(room.hostId).toBe('p2');
  });
});
