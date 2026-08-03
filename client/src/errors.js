const MESSAGES = {
  ROOM_NOT_FOUND: '그런 방이 없습니다. 코드를 다시 확인해주세요.',
  ROOM_FULL: '방이 가득 찼습니다. 최대 12명까지 들어갈 수 있습니다.',
  GAME_IN_PROGRESS: '이미 게임이 시작된 방입니다.',
  NICKNAME_TAKEN: '이미 쓰고 있는 닉네임입니다.',
  INVALID_NICKNAME: '닉네임은 1자 이상 12자 이하로 지어주세요.',
  PLAYER_NOT_FOUND: '이 방에서 자리를 찾을 수 없습니다.',
  NOT_HOST: '방장만 시작할 수 있습니다.',
  ALREADY_STARTED: '이미 시작된 게임입니다.',
  NOT_ENDED: '게임이 아직 끝나지 않았습니다.',
  BAD_PLAYER_COUNT: '5명에서 12명 사이여야 시작할 수 있습니다.',
  NOT_NIGHT: '지금은 밤이 아닙니다.',
  NOT_ALIVE: '죽은 사람은 할 수 없습니다.',
  WRONG_ROLE: '당신의 역할로는 할 수 없는 행동입니다.',
  INVALID_TARGET: '고를 수 없는 대상입니다.',
  SELF_NOT_ALLOWED: '자기 자신은 고를 수 없습니다.',
  CANNOT_TARGET_MAFIA: '같은 편은 고를 수 없습니다.',
  ALREADY_CONTACTED: '이미 접선에 성공했습니다.',
  ALREADY_ACTED: '이번 밤에는 이미 조사했습니다.',
  NOT_NOMINATE_PHASE: '지금은 지목 투표 시간이 아닙니다.',
  NOT_JUDGE_PHASE: '지금은 찬반 투표 시간이 아닙니다.',
  IS_NOMINEE: '지목된 사람은 투표할 수 없습니다.',
  INVALID_VOTE: '찬성 또는 반대를 다시 선택해주세요.',
  CHAT_BLOCKED: '지금은 이 채널에 말할 수 없습니다.',
};

export function errorMessage(code) {
  if (!code) return null;
  return MESSAGES[code] ?? '알 수 없는 오류가 났습니다.';
}
