export const ROLE = {
  MAFIA: 'MAFIA',
  SPY: 'SPY',
  DOCTOR: 'DOCTOR',
  POLICE: 'POLICE',
  CITIZEN: 'CITIZEN',
};

export const PHASE = {
  WAITING: 'WAITING',
  NIGHT: 'NIGHT',
  DAY_DISCUSSION: 'DAY_DISCUSSION',
  VOTE_NOMINATE: 'VOTE_NOMINATE',
  DEFENSE: 'DEFENSE',
  VOTE_JUDGE: 'VOTE_JUDGE',
  ENDED: 'ENDED',
};

export const PHASE_DURATION_MS = {
  [PHASE.NIGHT]: 30_000,
  [PHASE.DAY_DISCUSSION]: 120_000,
  [PHASE.VOTE_NOMINATE]: 30_000,
  [PHASE.DEFENSE]: 30_000,
  [PHASE.VOTE_JUDGE]: 20_000,
};

export const MIN_PLAYERS = 5;
export const MAX_PLAYERS = 12;

// 인원 구간별 마피아·스파이 수. 의사와 경찰은 항상 1명, 나머지는 시민.
const TABLE = [
  { maxPlayers: 6, MAFIA: 1, SPY: 0 },
  { maxPlayers: 9, MAFIA: 2, SPY: 1 },
  { maxPlayers: 12, MAFIA: 3, SPY: 1 },
];

export function roleCountsFor(playerCount) {
  if (playerCount < MIN_PLAYERS || playerCount > MAX_PLAYERS) {
    throw new Error(`인원은 ${MIN_PLAYERS}~${MAX_PLAYERS}명이어야 합니다 (받은 값: ${playerCount})`);
  }
  const row = TABLE.find((r) => playerCount <= r.maxPlayers);
  const counts = { MAFIA: row.MAFIA, SPY: row.SPY, DOCTOR: 1, POLICE: 1, CITIZEN: 0 };
  counts.CITIZEN = playerCount - (counts.MAFIA + counts.SPY + counts.DOCTOR + counts.POLICE);
  return counts;
}

export function assignRoles(playerIds, rng = Math.random) {
  const counts = roleCountsFor(playerIds.length);
  const pool = [];
  for (const [role, count] of Object.entries(counts)) {
    for (let i = 0; i < count; i++) pool.push(role);
  }
  const shuffled = shuffle(pool, rng);
  const assigned = {};
  playerIds.forEach((id, index) => {
    assigned[id] = shuffled[index];
  });
  return assigned;
}

function shuffle(array, rng) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
