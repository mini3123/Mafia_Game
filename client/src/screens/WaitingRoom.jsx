const MIN_PLAYERS = 5;
const MAX_PLAYERS = 12;

export default function WaitingRoom({ view, onStart, onLeave }) {
  const isHost = view.me?.id === view.hostId;
  const count = view.players.length;
  const enough = count >= MIN_PLAYERS;

  return (
    <main className="waiting">
      <header className="waiting__head">
        <p className="eyebrow">친구들에게 알려주세요</p>
        {/* 이 코드는 소리 내어 읽으라고 있는 것이다. 그래서 크고, 고정폭이고, 자간이 넓다. */}
        <strong className="roomcode">{view.code}</strong>
      </header>

      <p className="eyebrow eyebrow--count">
        참가자 {count}/{MAX_PLAYERS}
      </p>

      <ul className="roster">
        {view.players.map((p, index) => (
          <li key={p.id} className="seat">
            <span className="seat__no">{String(index + 1)}</span>
            <span className="seat__name">
              {p.nickname}
              {p.id === view.me?.id && <span className="seat__you">본인</span>}
            </span>
            {p.isHost && <span className="seat__host" aria-label="방장">방장</span>}
          </li>
        ))}
      </ul>

      {isHost ? (
        <>
          <button className="btn btn--primary" disabled={!enough} onClick={onStart}>
            게임 시작
          </button>
          {!enough && (
            <p className="hint">5명부터 시작할 수 있습니다. {MIN_PLAYERS - count}명 더 필요합니다.</p>
          )}
        </>
      ) : (
        <p className="hint">방장이 시작하기를 기다리는 중입니다…</p>
      )}

      <button className="btn btn--quiet" onClick={onLeave}>나가기</button>
    </main>
  );
}
