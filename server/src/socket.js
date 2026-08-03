import { PHASE } from './game/roles.js';
import { startGame, playerById, resetToWaiting } from './game/state.js';
import {
  submitNightAction, submitNominate, submitJudge, shouldEndNightEarly,
} from './game/actions.js';
import { advancePhase } from './game/phases.js';
import { viewFor } from './game/view.js';
import { canSend, recipientsOf } from './game/chat.js';
import { createNewRoom, joinRoom, rejoinRoom, leaveRoom } from './rooms.js';
import { startPhaseTimer, clearPhaseTimer } from './timers.js';

const MAX_MESSAGE_LENGTH = 300;

export function attachSocketServer(io, registry) {
  io.on('connection', (socket) => {
    socket.on('room:create', async ({ nickname } = {}, ack) => {
      const result = createNewRoom(registry, nickname);
      if (!result.ok) return respond(ack, result);
      await bind(socket, result.room, result.playerId);
      respond(ack, { ok: true, code: result.room.code, playerId: result.playerId });
      await broadcastState(io, result.room);
    });

    socket.on('room:join', async ({ code, nickname } = {}, ack) => {
      const result = joinRoom(registry, code, nickname);
      if (!result.ok) return respond(ack, result);
      await bind(socket, result.room, result.playerId);
      respond(ack, { ok: true, code: result.room.code, playerId: result.playerId });
      await broadcastState(io, result.room);
    });

    socket.on('room:rejoin', async ({ code, playerId } = {}, ack) => {
      const result = rejoinRoom(registry, code, playerId);
      if (!result.ok) return respond(ack, result);
      await bind(socket, result.room, playerId);
      respond(ack, { ok: true });
      socket.emit('chat:history', historyFor(result.room, playerId));
      await broadcastState(io, result.room);
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
        if (allowed.has(target.data.playerId)) target.emit('chat:message', message);
      }
    });

    socket.on('disconnect', async () => {
      const room = roomOf(registry, socket);
      if (!room) return;
      leaveRoom(registry, room.code, socket.data.playerId, { now: Date.now() });
      await broadcastState(io, room);
    });
  });
}

async function bind(socket, room, playerId) {
  socket.data.code = room.code;
  socket.data.playerId = playerId;
  await socket.join(room.code);
}

function roomOf(registry, socket) {
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
    if (socket.data.playerId) socket.emit('state:update', viewFor(room, socket.data.playerId));
  }
}

function schedulePhase(io, room) {
  clearPhaseTimer(room);
  if (room.phase === PHASE.WAITING || room.phase === PHASE.ENDED) return;
  startPhaseTimer(room, () => advanceAndBroadcast(io, room), { now: Date.now() });
}

function advanceAndBroadcast(io, room) {
  advancePhase(room, { now: Date.now() });
  schedulePhase(io, room);
  return broadcastState(io, room);
}
