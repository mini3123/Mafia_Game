import { PHASE } from './roles.js';
import { playerById, mafiaTeamIds } from './state.js';

export const CHANNEL = {
  PUBLIC: 'PUBLIC',
  MAFIA: 'MAFIA',
  GHOST: 'GHOST',
};

/** 살아있는 마피아 채팅 참여자. 접선에 성공한 스파이를 포함한다. */
function liveMafiaChat(room) {
  const teamIds = new Set(mafiaTeamIds(room));
  return room.players.filter((p) => p.alive && teamIds.has(p.id)).map((p) => p.id);
}

export function canSend(room, playerId, channel) {
  const player = playerById(room, playerId);
  if (!player) return false;

  if (channel === CHANNEL.GHOST) return !player.alive;
  if (!player.alive) return false;

  if (channel === CHANNEL.MAFIA) {
    return room.phase === PHASE.NIGHT && liveMafiaChat(room).includes(playerId);
  }

  if (channel === CHANNEL.PUBLIC) {
    if (room.phase === PHASE.DAY_DISCUSSION || room.phase === PHASE.VOTE_NOMINATE) return true;
    if (room.phase === PHASE.DEFENSE) return room.nominee === playerId;
    return false; // 밤, 찬반 투표, 대기, 종료
  }

  return false;
}

/**
 * 이 채널의 메시지를 받아야 할 사람들.
 * 유령 메시지는 살아있는 사람에게 아예 전송되지 않는다 — 화면에서 가리는 것이 아니다.
 */
export function recipientsOf(room, channel) {
  if (channel === CHANNEL.PUBLIC) return room.players.map((p) => p.id);
  if (channel === CHANNEL.GHOST) return room.players.filter((p) => !p.alive).map((p) => p.id);
  if (channel === CHANNEL.MAFIA) return liveMafiaChat(room);
  return [];
}

/** 그 사람 화면에 탭으로 띄울 채널 목록. 지금 말할 수 있는지와는 무관하다. */
export function availableChannels(room, playerId) {
  const player = playerById(room, playerId);
  if (!player) return [];

  const channels = [CHANNEL.PUBLIC];
  if (!player.alive) {
    channels.push(CHANNEL.GHOST);
    return channels;
  }
  if (mafiaTeamIds(room).includes(playerId)) channels.push(CHANNEL.MAFIA);
  return channels;
}
