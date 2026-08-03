import { ROLE_LABEL, TEAM_LABEL } from '../labels.js';

// 스파이는 마피아 팀이므로 마피아가 이길 때 함께 이긴다.
const MAFIA_TEAM = ['MAFIA', 'SPY'];

export default function Result({ view, onRestart, onLeave }) {
  const { winner, roles } = view.result;
  const seatOf = new Map(view.players.map((p, index) => [p.id, index + 1]));
  const byId = Object.fromEntries(view.players.map((p) => [p.id, p]));
  const isHost = view.me?.id === view.hostId;

  const myTeam = MAFIA_TEAM.includes(view.me?.role) ? 'MAFIA' : 'CITIZEN';
  const iWon = myTeam === winner;

  return (
    <main className="result">
      <header className={`result__head result__head--${winner.toLowerCase()}`}>
        <p className="eyebrow">{view.day}일차에 끝났습니다</p>
        <h1 className="result__winner">{TEAM_LABEL[winner]} 승리</h1>
        <p className="result__verdict">{iWon ? '당신은 이겼습니다' : '당신은 졌습니다'}</p>
      </header>

      <p className="eyebrow eyebrow--count">전원 직업 공개</p>

      <ul className="roster">
        {roles.map(({ id, role }) => (
          <li key={id} className="seat">
            <span className="seat__no">{String(seatOf.get(id) ?? '?')}</span>
            <span className="seat__name">
              {byId[id]?.nickname ?? '?'}
              {id === view.me?.id && <span className="seat__you">본인</span>}
            </span>
            <span className="seat__margin">
              <span
                className={`seat__team seat__team--${
                  MAFIA_TEAM.includes(role) ? 'mafia' : 'citizen'
                }`}
              >
                {ROLE_LABEL[role] ?? role}
              </span>
            </span>
          </li>
        ))}
      </ul>

      {isHost ? (
        <button className="btn btn--primary" onClick={onRestart}>다시 하기</button>
      ) : (
        <p className="hint">방장이 다시 시작하기를 기다리는 중입니다…</p>
      )}

      <button className="btn btn--quiet" onClick={onLeave}>나가기</button>
    </main>
  );
}
