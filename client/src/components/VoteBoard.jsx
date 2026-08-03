/** 지목 투표 득표 수. 명단 여백에 표시된다. */
export function voteCountsOf(view) {
  if (view.phase !== 'VOTE_NOMINATE') return {};
  const counts = {};
  for (const targetId of Object.values(view.votes ?? {})) {
    if (targetId) counts[targetId] = (counts[targetId] ?? 0) + 1;
  }
  return counts;
}

/** 지목 투표에서 고를 수 있는 사람. 대상도 명단에서 직접 고른다. */
export function nominateTargets(view) {
  if (view.phase !== 'VOTE_NOMINATE' || !view.me?.alive) return [];
  return view.players.filter((p) => p.alive && p.id !== view.me.id).map((p) => p.id);
}

export default function VoteBoard({ view, onNominate, onJudge }) {
  const byId = Object.fromEntries(view.players.map((p) => [p.id, p]));
  const nomineeName = view.nominee ? byId[view.nominee]?.nickname : null;
  const alive = Boolean(view.me?.alive);

  if (view.phase === 'VOTE_NOMINATE') {
    const cast = Object.entries(view.votes ?? {});

    return (
      <section className="vote">
        <p className="vote__ask">처형할 사람을 명단에서 지목하세요.</p>

        {alive && (
          <button className="btn btn--quiet vote__abstain" onClick={() => onNominate(null)}>
            기권
          </button>
        )}

        {cast.length > 0 && (
          <ul className="tally">
            {cast.map(([voterId, targetId]) => (
              <li key={voterId}>
                {byId[voterId]?.nickname} → {targetId ? byId[targetId]?.nickname : '기권'}
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  if (view.phase === 'DEFENSE') {
    const isNominee = view.nominee === view.me?.id;
    return (
      <section className="vote">
        <p className="vote__ask">{nomineeName}님의 최후 변론 시간입니다.</p>
        <p className="vote__note">
          {isNominee
            ? '지금 변론하세요. 당신만 말할 수 있습니다.'
            : '지목된 사람만 말할 수 있습니다.'}
        </p>
      </section>
    );
  }

  if (view.phase === 'VOTE_JUDGE') {
    const isNominee = view.nominee === view.me?.id;
    const votes = Object.values(view.judgeVotes ?? {});
    const yes = votes.filter((v) => v === true).length;
    const no = votes.filter((v) => v === false).length;
    const mine = view.judgeVotes?.[view.me?.id];

    return (
      <section className="vote">
        <p className="vote__ask">{nomineeName}님을 처형할까요?</p>

        {alive && !isNominee && (
          <div className="vote__judge">
            <button
              className="btn"
              aria-pressed={mine === true}
              onClick={() => onJudge(true)}
            >
              찬성
            </button>
            <button
              className="btn"
              aria-pressed={mine === false}
              onClick={() => onJudge(false)}
            >
              반대
            </button>
          </div>
        )}

        {isNominee && <p className="vote__note">당신의 처형 여부를 투표하는 중입니다.</p>}

        <p className="vote__count">찬성 {yes} · 반대 {no}</p>
        <p className="vote__note">찬성이 반대보다 많아야 처형됩니다.</p>
      </section>
    );
  }

  return null;
}
