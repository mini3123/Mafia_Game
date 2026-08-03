import { ROLE, PHASE } from './roles.js';
import { playerById, mafiaTeamIds } from './state.js';
import { availableChannels } from './chat.js';
import { ACTION } from './actions.js';

/**
 * 이 함수가 서버에서 클라이언트로 나가는 유일한 게임 상태 출구다.
 * 방 객체를 그대로 직렬화하지 말 것 — 필요한 필드만 골라 담는다.
 */
export function viewFor(room, playerId) {
  const me = playerById(room, playerId);
  const inMafiaChat = Boolean(me) && mafiaTeamIds(room).includes(playerId);

  return {
    code: room.code,
    phase: room.phase,
    day: room.day,
    phaseEndsAt: room.phaseEndsAt,
    hostId: room.hostId,

    players: room.players.map((p) => ({
      id: p.id,
      nickname: p.nickname,
      alive: p.alive,
      connected: p.connected,
      isHost: p.id === room.hostId,
      revealedTeam: p.alive ? null : p.revealedTeam,
    })),

    me: me
      ? {
          id: me.id,
          role: me.role,
          alive: me.alive,
          teammates: inMafiaChat ? mafiaTeamIds(room).filter((id) => id !== me.id) : [],
          investigations: me.role === ROLE.POLICE ? room.policeResults.map((r) => ({ ...r })) : [],
          knownJobs:
            me.role === ROLE.SPY
              ? Object.entries(room.spyKnownJobs).map(([targetId, role]) => ({ targetId, role }))
              : [],
          contactSucceeded: me.role === ROLE.SPY ? room.spyContacted : false,
        }
      : null,

    myAction: myActionOf(room, me),

    nightPicks:
      inMafiaChat && room.phase === PHASE.NIGHT
        ? Object.entries(room.night.mafiaPicks).map(([actorId, targetId]) => ({ actorId, targetId }))
        : [],

    myTimeAdjust: me ? (room.timeAdjustedBy?.[playerId] ?? null) : null,

    nominee: room.nominee,
    votes: room.phase === PHASE.VOTE_NOMINATE ? { ...room.votes } : {},
    judgeVotes: room.phase === PHASE.VOTE_JUDGE ? { ...room.judgeVotes } : {},

    lastNightResult: room.lastNightResult,
    lastExecution: room.lastExecution,

    availableChannels: me ? availableChannels(room, playerId) : [],
    result: room.result,
  };
}

/** 이번 밤에 내가 고른 행동. 남의 행동은 절대 돌려주지 않는다. */
function myActionOf(room, me) {
  if (!me || room.phase !== PHASE.NIGHT) return null;

  switch (me.role) {
    case ROLE.MAFIA: {
      const targetId = room.night.mafiaPicks[me.id];
      return targetId ? { type: ACTION.MAFIA_KILL, targetId } : null;
    }
    case ROLE.DOCTOR:
      return room.night.doctorSave
        ? { type: ACTION.DOCTOR_SAVE, targetId: room.night.doctorSave }
        : null;
    case ROLE.POLICE:
      return room.night.policeCheck
        ? { type: ACTION.POLICE_CHECK, targetId: room.night.policeCheck }
        : null;
    case ROLE.SPY:
      return room.night.spyContact
        ? { type: ACTION.SPY_CONTACT, targetId: room.night.spyContact }
        : null;
    default:
      return null;
  }
}
