import { ROLE, PHASE, PHASE_DURATION_MS } from './roles.js';
import { playerById, alivePlayers } from './state.js';

/** 한 사람이 한 페이즈에 움직일 수 있는 시간. */
export const TIME_STEP_MS = 20_000;
/** 아무리 줄여도 이만큼은 남긴다. */
export const MIN_REMAINING_MS = 5_000;

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
      // 직업은 즉시 공개되므로 같은 밤에 여러 명을 훑을 수 없게 한 번만 허용한다.
      if (room.night.spyContact) return fail('ALREADY_ACTED');
      room.night.spyContact = targetId;
      // 접선·조사는 즉시 판정한다. 접선 뒤에도 다음 밤부터 한 명씩 계속 조사할 수 있다.
      room.spyKnownJobs[targetId] = target.role;
      if (!room.spyContacted && target.role === ROLE.MAFIA) {
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
  if (spyAlive && !room.night.spyContact) return false;

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

/**
 * 페이즈 시간을 20초 늘리거나 줄인다. 한 사람이 한 페이즈에 한 번만.
 * 인원이 많을수록 크게 움직일 수 있지만, 바닥(5초)과 천장(기본 시간의 두 배)이 있다.
 */
export function adjustPhaseTime(room, playerId, direction, { now = 0 } = {}) {
  if (direction !== 'EXTEND' && direction !== 'SHORTEN') return fail('INVALID_ADJUST');
  if (!room.phaseEndsAt) return fail('NOT_TIMED_PHASE');

  const player = playerById(room, playerId);
  if (!player || !player.alive) return fail('NOT_ALIVE');
  if (room.timeAdjustedBy[playerId]) return fail('ALREADY_ADJUSTED');

  const base = PHASE_DURATION_MS[room.phase] ?? 0;
  const floor = now + MIN_REMAINING_MS;
  const ceiling = now + base * 2;

  if (direction === 'EXTEND') {
    room.phaseEndsAt = Math.min(room.phaseEndsAt + TIME_STEP_MS, ceiling);
  } else {
    // 이미 5초 미만이면 바닥값 때문에 시간이 도리어 늘어나서는 안 된다.
    const nonIncreasingFloor = Math.min(room.phaseEndsAt, floor);
    room.phaseEndsAt = Math.max(room.phaseEndsAt - TIME_STEP_MS, nonIncreasingFloor);
  }
  room.timeAdjustedBy[playerId] = direction;
  return OK;
}

export function submitJudge(room, playerId, approve) {
  if (room.phase !== PHASE.VOTE_JUDGE) return fail('NOT_JUDGE_PHASE');
  if (typeof approve !== 'boolean') return fail('INVALID_VOTE');

  const voter = playerById(room, playerId);
  if (!voter || !voter.alive) return fail('NOT_ALIVE');
  if (playerId === room.nominee) return fail('IS_NOMINEE');

  room.judgeVotes[playerId] = approve;
  return OK;
}
