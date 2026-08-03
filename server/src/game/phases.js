import { ROLE, PHASE } from './roles.js';
import { playerById, killPlayer, setPhase, emptyNight } from './state.js';
import { checkAndSetVictory } from './victory.js';

/**
 * 밤 행동을 해결한다. 스파이 접선은 제출 시점에 이미 처리되었으므로 여기서 다루지 않는다.
 * 순서가 중요하다 — 의사 보호를 먼저 판정하고 그다음 살해를 적용한다.
 */
export function resolveNight(room, { now = 0, rng = Math.random } = {}) {
  const target = pickMafiaTarget(room, rng);
  const blocked = Boolean(target) && target === room.night.doctorSave;
  const killedId = target && !blocked ? target : null;

  if (killedId) killPlayer(room, killedId);
  room.lastNightResult = { killedId, blocked };

  if (room.night.policeCheck) {
    const checked = playerById(room, room.night.policeCheck);
    room.policeResults.push({
      day: room.day,
      targetId: checked.id,
      isMafia: checked.role === ROLE.MAFIA,
    });
  }

  checkAndSetVictory(room, now);
}

/** 마피아들의 지목을 집계한다. 최다 득표, 동점이면 그중 무작위. */
function pickMafiaTarget(room, rng) {
  const picks = Object.values(room.night.mafiaPicks).filter(Boolean);
  if (picks.length === 0) return null;

  const tally = {};
  for (const targetId of picks) tally[targetId] = (tally[targetId] ?? 0) + 1;

  const top = Math.max(...Object.values(tally));
  const tied = Object.keys(tally).filter((id) => tally[id] === top);
  return tied[Math.floor(rng() * tied.length)];
}

/** 최다 득표자가 유일할 때만 최후 변론 대상이 된다. 동점이면 그날은 아무도 죽지 않는다. */
export function tallyNominate(room) {
  const tally = {};
  for (const targetId of Object.values(room.votes)) {
    if (targetId) tally[targetId] = (tally[targetId] ?? 0) + 1;
  }

  const entries = Object.entries(tally);
  if (entries.length === 0) {
    room.nominee = null;
    return;
  }

  const top = Math.max(...entries.map(([, count]) => count));
  const tied = entries.filter(([, count]) => count === top);
  room.nominee = tied.length === 1 ? tied[0][0] : null;
}

/** 찬성이 반대보다 많을 때만 처형한다. 동수면 살아남는다. */
export function tallyJudge(room, { now = 0 } = {}) {
  const nomineeId = room.nominee;
  const votes = Object.values(room.judgeVotes);
  const yes = votes.filter((v) => v === true).length;
  const no = votes.filter((v) => v === false).length;
  const executed = yes > no;

  room.lastExecution = { nomineeId, yes, no, executed };
  room.nominee = null;

  if (executed && nomineeId) {
    killPlayer(room, nomineeId);
    checkAndSetVictory(room, now);
  }
}

export function startNight(room, { now = 0 } = {}) {
  room.day += 1;
  room.night = emptyNight();
  room.votes = {};
  room.judgeVotes = {};
  room.nominee = null;
  setPhase(room, PHASE.NIGHT, now);
}

/** 현재 페이즈를 마감하고 다음 페이즈로 넘긴다. 전이 후의 페이즈를 돌려준다. */
export function advancePhase(room, { now = 0, rng = Math.random } = {}) {
  switch (room.phase) {
    case PHASE.NIGHT:
      resolveNight(room, { now, rng });
      if (room.result) return room.phase; // checkAndSetVictory가 ENDED로 바꿔둔다
      setPhase(room, PHASE.DAY_DISCUSSION, now);
      return room.phase;

    case PHASE.DAY_DISCUSSION:
      setPhase(room, PHASE.VOTE_NOMINATE, now);
      return room.phase;

    case PHASE.VOTE_NOMINATE:
      tallyNominate(room);
      if (room.nominee) setPhase(room, PHASE.DEFENSE, now);
      else startNight(room, { now });
      return room.phase;

    case PHASE.DEFENSE:
      // 찬반 투표는 항상 빈 표에서 시작한다. 이전 페이즈의 늦은/남은 값을 승계하지 않는다.
      room.judgeVotes = {};
      setPhase(room, PHASE.VOTE_JUDGE, now);
      return room.phase;

    case PHASE.VOTE_JUDGE:
      tallyJudge(room, { now });
      if (room.result) return room.phase;
      startNight(room, { now });
      return room.phase;

    default:
      return room.phase; // WAITING, ENDED
  }
}
