import { randomUUID } from 'node:crypto';
import { PHASE, MAX_PLAYERS } from './game/roles.js';
import { createRoom, addPlayerToRoom, playerById } from './game/state.js';

// 0 O 1 I를 뺀 32자. 코드를 불러줄 때 헷갈리지 않게 한다.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
const MAX_NICKNAME_LENGTH = 12;

export const EMPTY_ROOM_TTL_MS = 300_000; // 5분

export function createRegistry() {
  return { rooms: new Map() };
}

export function generateCode(rng = Math.random) {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[Math.floor(rng() * CODE_ALPHABET.length)];
  }
  return code;
}

const fail = (code) => ({ ok: false, code });

function normalizeNickname(raw) {
  const nickname = String(raw ?? '').trim();
  if (nickname.length === 0 || nickname.length > MAX_NICKNAME_LENGTH) return null;
  return nickname;
}

function uniqueCode(registry, rng) {
  let code = generateCode(rng);
  while (registry.rooms.has(code)) code = generateCode(rng);
  return code;
}

export function createNewRoom(
  registry,
  rawNickname,
  { rng = Math.random, newId = randomUUID, newResumeToken = randomUUID } = {},
) {
  const nickname = normalizeNickname(rawNickname);
  if (!nickname) return fail('INVALID_NICKNAME');

  const playerId = newId();
  const resumeToken = newResumeToken();
  const room = createRoom(uniqueCode(registry, rng), playerId);
  addPlayerToRoom(room, { id: playerId, nickname, resumeToken });
  registry.rooms.set(room.code, room);

  return { ok: true, room, playerId, resumeToken };
}

export function joinRoom(
  registry,
  rawCode,
  rawNickname,
  { newId = randomUUID, newResumeToken = randomUUID } = {},
) {
  const room = registry.rooms.get(String(rawCode ?? '').toUpperCase());
  if (!room) return fail('ROOM_NOT_FOUND');

  const nickname = normalizeNickname(rawNickname);
  if (!nickname) return fail('INVALID_NICKNAME');
  if (room.phase !== PHASE.WAITING) return fail('GAME_IN_PROGRESS');
  if (room.players.length >= MAX_PLAYERS) return fail('ROOM_FULL');
  if (room.players.some((p) => p.nickname === nickname)) return fail('NICKNAME_TAKEN');

  const playerId = newId();
  const resumeToken = newResumeToken();
  addPlayerToRoom(room, { id: playerId, nickname, resumeToken });
  return { ok: true, room, playerId, resumeToken };
}

export function rejoinRoom(registry, rawCode, resumeToken) {
  const room = registry.rooms.get(String(rawCode ?? '').toUpperCase());
  if (!room) return fail('ROOM_NOT_FOUND');

  const player = room.players.find((candidate) =>
    candidate.resumeToken && candidate.resumeToken === resumeToken);
  if (!player) return fail('PLAYER_NOT_FOUND');

  player.connected = true;
  player.disconnectedAt = null;
  room.emptySince = null;
  return { ok: true, room, playerId: player.id };
}

/**
 * 네트워크 단절은 명시적인 나가기와 다르다. 자리를 남겨 새로고침으로 복구할 수 있게 한다.
 * expectedSocketId가 현재 연결과 다르면 교체된 옛 소켓의 늦은 disconnect이므로 무시한다.
 */
export function disconnectRoom(
  registry,
  rawCode,
  playerId,
  { now = 0, expectedSocketId = null } = {},
) {
  const room = registry.rooms.get(String(rawCode ?? '').toUpperCase());
  if (!room) return false;

  const player = playerById(room, playerId);
  if (!player) return false;
  if (expectedSocketId && player.socketId !== expectedSocketId) return false;

  player.connected = false;
  player.socketId = null;
  player.disconnectedAt = now;
  updateEmptySince(room, now);
  return true;
}

/**
 * 대기 중이면 자리를 없애고, 게임 중이면 자리를 남긴 채 연결만 끊는다.
 * 한 명이 나갔다고 나머지가 기다리는 상황을 만들지 않기 위해서다.
 */
export function leaveRoom(registry, rawCode, playerId, { now = 0 } = {}) {
  const room = registry.rooms.get(String(rawCode ?? '').toUpperCase());
  if (!room) return;

  const player = playerById(room, playerId);
  if (!player) return;

  if (room.phase === PHASE.WAITING) {
    room.players = room.players.filter((p) => p.id !== playerId);
  } else {
    player.connected = false;
    player.socketId = null;
    player.disconnectedAt = now;
  }

  succeedHost(room);
  updateEmptySince(room, now);
}

function updateEmptySince(room, now) {
  const anyConnected = room.players.some((p) => p.connected);
  room.emptySince = anyConnected ? null : now;
}

export function succeedHost(room) {
  const host = playerById(room, room.hostId);
  if (host && host.connected) return;
  const next = room.players.find((p) => p.connected);
  if (next) room.hostId = next.id;
}

/** 유예 시간이 지난 빈 방을 지운다. 삭제한 코드 목록을 돌려준다. */
export function sweepEmptyRooms(registry, { now = 0 } = {}) {
  const removed = [];
  for (const [code, room] of registry.rooms) {
    if (room.emptySince !== null && now - room.emptySince > EMPTY_ROOM_TTL_MS) {
      registry.rooms.delete(code);
      removed.push(code);
    }
  }
  return removed;
}
