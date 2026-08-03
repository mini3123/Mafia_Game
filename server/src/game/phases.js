import { ROLE } from './roles.js';
import { playerById, killPlayer } from './state.js';
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
