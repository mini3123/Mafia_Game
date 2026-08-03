import { playerById } from './state.js';

/**
 * 사망자는 직업이 아니라 진영만 공개된다.
 * 받침에 따라 조사가 달라지므로 문장째로 둔다.
 */
const TEAM_WAS = {
  MAFIA: '마피아였습니다.',
  CITIZEN: '시민이었습니다.',
};

/** 밤 결과를 채팅에 남길 한 줄로 만든다. 남길 게 없으면 null. */
export function nightAnnouncement(room) {
  const result = room.lastNightResult;
  if (!result) return null;

  if (!result.killedId) return '밤 사이 아무도 죽지 않았습니다.';

  const victim = playerById(room, result.killedId);
  if (!victim) return null;
  return `${victim.nickname}님이 밤 사이 사망했습니다. ${TEAM_WAS[victim.revealedTeam]}`;
}

/** 찬반 투표 결과를 채팅에 남길 한 줄로 만든다. 남길 게 없으면 null. */
export function executionAnnouncement(room) {
  const result = room.lastExecution;
  if (!result?.nomineeId) return null;

  const target = playerById(room, result.nomineeId);
  if (!target) return null;

  if (!result.executed) return `${target.nickname}님은 처형되지 않았습니다.`;
  return `${target.nickname}님이 처형되었습니다. ${TEAM_WAS[target.revealedTeam]}`;
}
