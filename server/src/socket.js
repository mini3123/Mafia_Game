import { PHASE } from './game/roles.js';
import { startGame, playerById, resetToWaiting } from './game/state.js';
import {
  submitNightAction, submitNominate, submitJudge, shouldEndNightEarly, adjustPhaseTime,
} from './game/actions.js';
import { advancePhase } from './game/phases.js';
import { viewFor } from './game/view.js';
import { CHANNEL, canSend, recipientsOf } from './game/chat.js';
import { executionAnnouncement, nightAnnouncement } from './game/announce.js';
import {
  createNewRoom, joinRoom, rejoinRoom, leaveRoom, disconnectRoom, succeedHost,
} from './rooms.js';
import { startPhaseTimer, clearPhaseTimer } from './timers.js';

const MAX_MESSAGE_LENGTH = 300;
const HOST_RECONNECT_GRACE_MS = 3_000;

export function attachSocketServer(io, registry) {
  io.on('connection', (socket) => {
    socket.on('room:create', async ({ nickname } = {}, ack) => {
      const result = createNewRoom(registry, nickname);
      if (!result.ok) return respond(ack, result);
      await bind(socket, result.room, result.playerId);
      respond(ack, {
        ok: true,
        code: result.room.code,
        playerId: result.playerId,
        resumeToken: result.resumeToken,
      });
      await broadcastState(io, result.room);
    });

    socket.on('room:join', async ({ code, nickname } = {}, ack) => {
      const result = joinRoom(registry, code, nickname);
      if (!result.ok) return respond(ack, result);
      await bind(socket, result.room, result.playerId);
      respond(ack, {
        ok: true,
        code: result.room.code,
        playerId: result.playerId,
        resumeToken: result.resumeToken,
      });
      await broadcastState(io, result.room);
    });

    socket.on('room:rejoin', async ({ code, resumeToken } = {}, ack) => {
      const result = rejoinRoom(registry, code, resumeToken);
      if (!result.ok) return respond(ack, result);
      await bind(socket, result.room, result.playerId);
      respond(ack, { ok: true });
      socket.emit('chat:history', historyFor(result.room, result.playerId));
      await broadcastState(io, result.room);
    });

    socket.on('room:leave', async (_payload, ack) => {
      const room = roomOf(registry, socket);
      if (!room) return respond(ack, { ok: true });

      const code = room.code;
      if (room.hostId === socket.data.playerId) clearHostTransfer(room);
      leaveRoom(registry, code, socket.data.playerId, { now: Date.now() });
      await socket.leave(code);
      socket.data.code = null;
      socket.data.playerId = null;
      respond(ack, { ok: true });
      await broadcastState(io, room);
    });

    socket.on('game:start', async () => {
      const room = roomOf(registry, socket);
      if (!room) return;
      if (socket.data.playerId !== room.hostId) return socket.emit('error', { code: 'NOT_HOST' });
      if (room.phase !== PHASE.WAITING) return socket.emit('error', { code: 'ALREADY_STARTED' });

      try {
        startGame(room, { now: Date.now() });
      } catch {
        return socket.emit('error', { code: 'BAD_PLAYER_COUNT' });
      }
      schedulePhase(io, room);
      await broadcastState(io, room);
    });

    socket.on('game:restart', async () => {
      const room = roomOf(registry, socket);
      if (!room) return;
      if (socket.data.playerId !== room.hostId) return socket.emit('error', { code: 'NOT_HOST' });
      if (room.phase !== PHASE.ENDED) return socket.emit('error', { code: 'NOT_ENDED' });

      clearPhaseTimer(room);
      resetToWaiting(room);
      await broadcastState(io, room);
    });

    socket.on('action:submit', async ({ type, targetId } = {}) => {
      const room = roomOf(registry, socket);
      if (!room) return;

      const result = submitNightAction(room, socket.data.playerId, { type, targetId });
      if (!result.ok) return socket.emit('error', { code: result.code });

      if (shouldEndNightEarly(room)) return advanceAndBroadcast(io, room);
      await broadcastState(io, room);
    });

    socket.on('time:adjust', async ({ direction } = {}) => {
      const room = roomOf(registry, socket);
      if (!room) return;

      const result = adjustPhaseTime(room, socket.data.playerId, direction, { now: Date.now() });
      if (!result.ok) return socket.emit('error', { code: result.code });

      schedulePhase(io, room); // 바뀐 종료 시각으로 타이머를 다시 건다
      const who = playerById(room, socket.data.playerId).nickname;
      const what = direction === 'EXTEND' ? '늘렸' : '줄였';
      await announce(io, room, `${who}님이 시간을 20초 ${what}습니다.`);
      await broadcastState(io, room);
    });

    socket.on('vote:nominate', async ({ targetId } = {}) => {
      const room = roomOf(registry, socket);
      if (!room) return;
      const result = submitNominate(room, socket.data.playerId, targetId ?? null);
      if (!result.ok) return socket.emit('error', { code: result.code });
      await broadcastState(io, room);
    });

    socket.on('vote:judge', async ({ approve } = {}) => {
      const room = roomOf(registry, socket);
      if (!room) return;
      const result = submitJudge(room, socket.data.playerId, approve);
      if (!result.ok) return socket.emit('error', { code: result.code });
      await broadcastState(io, room);
    });

    socket.on('chat:send', async ({ channel, text } = {}) => {
      const room = roomOf(registry, socket);
      if (!room) return;

      const playerId = socket.data.playerId;
      if (!canSend(room, playerId, channel)) return socket.emit('error', { code: 'CHAT_BLOCKED' });

      const body = String(text ?? '').trim().slice(0, MAX_MESSAGE_LENGTH);
      if (!body) return;

      const message = {
        channel,
        senderId: playerId,
        senderName: playerById(room, playerId).nickname,
        text: body,
        at: Date.now(),
      };
      const recipients = recipientsOf(room, channel);
      room.chatLog.push({ ...message, recipients });

      // 받을 자격이 있는 소켓에만 보낸다. 유령 메시지는 산 사람에게 전송조차 되지 않는다.
      const allowed = new Set(recipients);
      for (const target of await io.in(room.code).fetchSockets()) {
        const targetPlayer = playerById(room, target.data.playerId);
        if (targetPlayer?.socketId === target.id && allowed.has(target.data.playerId)) {
          target.emit('chat:message', message);
        }
      }
    });

    socket.on('disconnect', async () => {
      const room = rawRoomOf(registry, socket);
      if (!room) return;
      const disconnected = disconnectRoom(registry, room.code, socket.data.playerId, {
        now: Date.now(),
        expectedSocketId: socket.id,
      });
      if (disconnected && room.hostId === socket.data.playerId) {
        scheduleHostTransfer(io, room);
      }
      await broadcastState(io, room);
    });
  });
}

async function bind(socket, room, playerId) {
  socket.data.code = room.code;
  socket.data.playerId = playerId;
  const player = playerById(room, playerId);
  if (player) {
    if (room.hostId === playerId) clearHostTransfer(room);
    player.socketId = socket.id;
    player.connected = true;
    player.disconnectedAt = null;
  }
  await socket.join(room.code);
}

function clearHostTransfer(room) {
  if (!room.hostTransferTimer) return;
  clearTimeout(room.hostTransferTimer);
  room.hostTransferTimer = null;
}

function scheduleHostTransfer(io, room) {
  clearHostTransfer(room);
  room.hostTransferTimer = setTimeout(async () => {
    room.hostTransferTimer = null;
    succeedHost(room);
    await broadcastState(io, room);
  }, HOST_RECONNECT_GRACE_MS);
  room.hostTransferTimer.unref?.();
}

function roomOf(registry, socket) {
  const room = rawRoomOf(registry, socket);
  const player = room && playerById(room, socket.data.playerId);
  return player?.socketId === socket.id ? room : undefined;
}

function rawRoomOf(registry, socket) {
  return socket.data.code ? registry.rooms.get(socket.data.code) : undefined;
}

function respond(ack, payload) {
  if (typeof ack === 'function') ack(payload);
}

function historyFor(room, playerId) {
  return room.chatLog
    .filter((entry) => entry.recipients.includes(playerId))
    .map(({ recipients, ...message }) => message);
}

/** 방의 각 소켓에 그 사람 몫의 뷰만 보낸다. */
async function broadcastState(io, room) {
  for (const socket of await io.in(room.code).fetchSockets()) {
    const player = playerById(room, socket.data.playerId);
    if (player?.socketId === socket.id) {
      socket.emit('state:update', viewFor(room, socket.data.playerId));
    }
  }
}

function schedulePhase(io, room) {
  clearPhaseTimer(room);
  if (room.phase === PHASE.WAITING || room.phase === PHASE.ENDED) return;
  startPhaseTimer(room, () => advanceAndBroadcast(io, room), { now: Date.now() });
}

/** 시스템 알림. 전원이 받고, 채팅 기록에도 남아 재접속 시 복구된다. */
async function announce(io, room, text) {
  const message = {
    channel: CHANNEL.PUBLIC,
    system: true,
    senderId: null,
    senderName: null,
    text,
    at: Date.now(),
  };
  const recipients = room.players.map((p) => p.id);
  room.chatLog.push({ ...message, recipients });

  for (const target of await io.in(room.code).fetchSockets()) {
    const player = playerById(room, target.data.playerId);
    if (player?.socketId === target.id) target.emit('chat:message', message);
  }
}

async function advanceAndBroadcast(io, room) {
  const from = room.phase;
  advancePhase(room, { now: Date.now() });
  schedulePhase(io, room);

  // 밤이 끝나면 사망 결과를, 찬반 투표가 끝나면 처형 결과를 채팅에 남긴다.
  const text =
    from === PHASE.NIGHT ? nightAnnouncement(room)
      : from === PHASE.VOTE_JUDGE ? executionAnnouncement(room)
        : null;
  if (text) await announce(io, room, text);

  await broadcastState(io, room);
}
