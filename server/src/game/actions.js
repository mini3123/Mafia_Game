import { ROLE, PHASE } from './roles.js';
import { playerById, alivePlayers } from './state.js';

export const ACTION = {
  MAFIA_KILL: 'MAFIA_KILL',
  DOCTOR_SAVE: 'DOCTOR_SAVE',
  POLICE_CHECK: 'POLICE_CHECK',
  SPY_CONTACT: 'SPY_CONTACT',
};

const REQUIRED_ROLE = {
  [ACTION.MAFIA_KILL]: ROLE.MAFIA,
  [ACTION.DOCTOR_SAVE]: ROLE.DOCTOR,
  [ACTION.POLICE_CHECK]: ROLE.POLICE,
  [ACTION.SPY_CONTACT]: ROLE.SPY,
};

const fail = (code) => ({ ok: false, code });
const OK = { ok: true };

export function submitNightAction(room, playerId, { type, targetId }) {
  if (room.phase !== PHASE.NIGHT) return fail('NOT_NIGHT');

  const actor = playerById(room, playerId);
  if (!actor || !actor.alive) return fail('NOT_ALIVE');
  if (actor.role !== REQUIRED_ROLE[type]) return fail('WRONG_ROLE');

  const target = playerById(room, targetId);
  if (!target || !target.alive) return fail('INVALID_TARGET');

  // 의사만 자기 자신을 지목할 수 있다.
  if (type !== ACTION.DOCTOR_SAVE && targetId === playerId) return fail('SELF_NOT_ALLOWED');

  switch (type) {
    case ACTION.MAFIA_KILL:
      if (target.role === ROLE.MAFIA) return fail('CANNOT_TARGET_MAFIA');
      room.night.mafiaPicks[playerId] = targetId;
      return OK;

    case ACTION.DOCTOR_SAVE:
      room.night.doctorSave = targetId;
      return OK;

    case ACTION.POLICE_CHECK:
      room.night.policeCheck = targetId;
      return OK;

    case ACTION.SPY_CONTACT: {
      if (room.spyContacted) return fail('ALREADY_CONTACTED');
      room.night.spyContact = targetId;
      // 접선만 즉시 판정한다. 밤 종료까지 미루면 아무리 빨라도 다음 밤에야 합류하게 된다.
      room.spyKnownJobs[targetId] = target.role;
      if (target.role === ROLE.MAFIA) {
        room.spyContacted = true;
        room.spyContactedOnDay = room.day;
      }
      return OK;
    }

    default:
      return fail('WRONG_ROLE');
  }
}

/**
 * 밤에 행동할 사람이 모두 행동을 마쳤는지 본다.
 * 접선에 성공한 밤은 예외적으로 false를 돌려준다 —
 * 방금 마피아 채팅에 합류한 스파이에게 대화할 시간을 줘야 한다.
 */
export function shouldEndNightEarly(room) {
  if (room.phase !== PHASE.NIGHT) return false;
  if (room.spyContactedOnDay === room.day) return false;

  const alive = alivePlayers(room);

  const mafias = alive.filter((p) => p.role === ROLE.MAFIA);
  if (mafias.some((p) => !room.night.mafiaPicks[p.id])) return false;

  if (alive.some((p) => p.role === ROLE.DOCTOR) && !room.night.doctorSave) return false;
  if (alive.some((p) => p.role === ROLE.POLICE) && !room.night.policeCheck) return false;

  const spyAlive = alive.some((p) => p.role === ROLE.SPY);
  if (spyAlive && !room.spyContacted && !room.night.spyContact) return false;

  return true;
}

export function submitNominate(room, playerId, targetId) {
  if (room.phase !== PHASE.VOTE_NOMINATE) return fail('NOT_NOMINATE_PHASE');

  const voter = playerById(room, playerId);
  if (!voter || !voter.alive) return fail('NOT_ALIVE');

  if (targetId === null || targetId === undefined) {
    room.votes[playerId] = null; // 기권
    return OK;
  }

  if (targetId === playerId) return fail('SELF_NOT_ALLOWED');
  const target = playerById(room, targetId);
  if (!target || !target.alive) return fail('INVALID_TARGET');

  room.votes[playerId] = targetId;
  return OK;
}

export function submitJudge(room, playerId, approve) {
  if (room.phase !== PHASE.VOTE_JUDGE) return fail('NOT_JUDGE_PHASE');

  const voter = playerById(room, playerId);
  if (!voter || !voter.alive) return fail('NOT_ALIVE');
  if (playerId === room.nominee) return fail('IS_NOMINEE');

  room.judgeVotes[playerId] = Boolean(approve);
  return OK;
}
