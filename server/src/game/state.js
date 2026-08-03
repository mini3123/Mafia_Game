import {
  ROLE, PHASE, PHASE_DURATION_MS,
  MIN_PLAYERS, MAX_PLAYERS, assignRoles,
} from './roles.js';

export function createRoom(code, hostId) {
  return {
    code,
    hostId,
    phase: PHASE.WAITING,
    day: 0,
    phaseEndsAt: null,
    timeAdjustedBy: {},
    players: [],
    night: emptyNight(),
    policeResults: [],
    spyKnownJobs: {},
    spyContacted: false,
    spyContactedOnDay: null,
    votes: {},
    judgeVotes: {},
    nominee: null,
    lastNightResult: null,
    lastExecution: null,
    result: null,
    chatLog: [],
    emptySince: null,
    timer: null,
  };
}

export function emptyNight() {
  return { mafiaPicks: {}, doctorSave: null, policeCheck: null, spyContact: null };
}

export function addPlayerToRoom(room, { id, nickname, resumeToken = null }) {
  room.players.push({
    id,
    nickname,
    // id는 투표·지목에 쓰는 공개 식별자다. 재접속 인증에는 별도 비밀 토큰을 쓴다.
    resumeToken,
    socketId: null,
    role: null,
    alive: true,
    connected: true,
    disconnectedAt: null,
    revealedTeam: null,
  });
  room.emptySince = null;
}

export function startGame(room, { now = 0, rng = Math.random } = {}) {
  // 이전 연결이 끊긴 대기실 자리는 새 판에 포함하지 않는다.
  room.players = room.players.filter((player) => player.connected);
  const count = room.players.length;
  if (count < MIN_PLAYERS || count > MAX_PLAYERS) {
    throw new Error(`인원은 ${MIN_PLAYERS}~${MAX_PLAYERS}명이어야 합니다 (현재 ${count}명)`);
  }
  const assigned = assignRoles(room.players.map((p) => p.id), rng);
  for (const player of room.players) {
    player.role = assigned[player.id];
    player.alive = true;
    player.revealedTeam = null;
  }
  room.day = 1;
  room.night = emptyNight();
  room.policeResults = [];
  room.spyKnownJobs = {};
  room.spyContacted = false;
  room.spyContactedOnDay = null;
  room.votes = {};
  room.judgeVotes = {};
  room.nominee = null;
  room.lastNightResult = null;
  room.lastExecution = null;
  room.result = null;
  room.chatLog = [];
  setPhase(room, PHASE.NIGHT, now);
}

export function setPhase(room, phase, now) {
  room.phase = phase;
  const duration = PHASE_DURATION_MS[phase];
  room.phaseEndsAt = duration ? now + duration : null;
  // 시간 조절권은 페이즈마다 새로 주어진다.
  room.timeAdjustedBy = {};
}

export function playerById(room, playerId) {
  return room.players.find((p) => p.id === playerId);
}

export function alivePlayers(room) {
  return room.players.filter((p) => p.alive);
}

// 마피아 채팅에 속한 사람들. 생사와 무관하게 "누가 한편인지"를 나타낸다.
export function mafiaTeamIds(room) {
  return room.players
    .filter((p) => p.role === ROLE.MAFIA || (p.role === ROLE.SPY && room.spyContacted))
    .map((p) => p.id);
}

export function killPlayer(room, playerId) {
  const player = playerById(room, playerId);
  if (!player || !player.alive) return;
  player.alive = false;
  player.revealedTeam = player.role === ROLE.MAFIA ? 'MAFIA' : 'CITIZEN';
}

/** 게임을 끝낸 방을 대기실로 되돌린다. 참가자와 방장은 유지한다. */
export function resetToWaiting(room) {
  // 게임 중 나간 사람을 다음 판의 유령 참가자로 남기지 않는다.
  room.players = room.players.filter((player) => player.connected);
  if (!room.players.some((player) => player.id === room.hostId)) {
    room.hostId = room.players[0]?.id ?? null;
  }
  for (const player of room.players) {
    player.role = null;
    player.alive = true;
    player.revealedTeam = null;
  }
  room.day = 0;
  room.night = emptyNight();
  room.policeResults = [];
  room.spyKnownJobs = {};
  room.spyContacted = false;
  room.spyContactedOnDay = null;
  room.votes = {};
  room.judgeVotes = {};
  room.nominee = null;
  room.lastNightResult = null;
  room.lastExecution = null;
  room.result = null;
  room.chatLog = [];
  room.phase = PHASE.WAITING;
  room.phaseEndsAt = null;
}
