import { TEAM_LABEL } from '../labels.js';

/**
 * 참가자 명단.
 *
 * 오른쪽 여백이 이 게임의 핵심이다. 모두가 같은 명단을 보지만,
 * 여백에 적히는 것은 사람마다 다르다. 마피아에게는 동료가, 경찰에게는 조사 결과가,
 * 스파이에게는 알아낸 직업이 적힌다. 시민의 여백은 끝까지 비어 있다.
 */
export default function Roster({
  players, me, selectableIds = [], selectedId = null,
  onSelect = () => {}, annotations = {}, voteCounts = {},
}) {
  const picking = selectableIds.length > 0;

  return (
    <ul className={`roster${picking ? ' roster--picking' : ''}`}>
      {players.map((player, index) => {
        const selectable = selectableIds.includes(player.id);
        const note = annotations[player.id];
        const votes = voteCounts[player.id] ?? 0;

        return (
          <li key={player.id}>
            <button
              type="button"
              className={`seat${player.alive ? '' : ' seat--dead'}`}
              disabled={!selectable}
              aria-pressed={selectedId === player.id}
              onClick={() => onSelect(player.id)}
            >
              <span className="seat__no">{String(index + 1)}</span>

              <span className="seat__name">
                {player.nickname}
                {player.id === me?.id && <span className="seat__you">본인</span>}
                {!player.connected && (
                  <span className="seat__off" aria-label="연결 끊김" title="연결 끊김">끊김</span>
                )}
              </span>

              <span className="seat__margin">
                {votes > 0 && <span className="seat__votes">{votes}표</span>}
                {!player.alive && (
                  <span className={`seat__team seat__team--${String(player.revealedTeam).toLowerCase()}`}>
                    {TEAM_LABEL[player.revealedTeam] ?? '?'}
                  </span>
                )}
                {/* 나만 아는 것. 호박색은 여기에만 쓴다. */}
                {note && <span className="seat__note">{note}</span>}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
