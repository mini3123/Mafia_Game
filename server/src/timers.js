/**
 * room.phaseEndsAt까지 남은 시간만큼 기다렸다가 onExpire를 부른다.
 * 타이머 핸들은 room.timer에 둔다 — viewFor가 필드를 골라 담으므로 클라이언트로 새지 않는다.
 */
export function startPhaseTimer(room, onExpire, { now = Date.now() } = {}) {
  clearPhaseTimer(room);
  if (!room.phaseEndsAt) return;

  const delay = Math.max(0, room.phaseEndsAt - now);
  room.timer = setTimeout(() => {
    room.timer = null;
    onExpire(room);
  }, delay);
}

export function clearPhaseTimer(room) {
  if (room.timer) {
    clearTimeout(room.timer);
    room.timer = null;
  }
}
