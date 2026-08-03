import PhaseBanner from '../components/PhaseBanner.jsx';
import Roster from '../components/Roster.jsx';
import ActionPrompt, { ACTION, nightActionFor } from '../components/ActionPrompt.jsx';
import VoteBoard, { voteCountsOf, nominateTargets } from '../components/VoteBoard.jsx';
import ChatPanel from '../components/ChatPanel.jsx';
import Scope from '../components/Scope.jsx';
import { ROLE_LABEL } from '../labels.js';
import { errorMessage } from '../errors.js';

/**
 * 내 역할 덕분에 알게 된 것들을 명단 여백에 적을 문구로 바꾼다.
 * 시민에게는 아무것도 나오지 않는다 — 그게 시민의 처지다.
 */
export function annotationsFor(view) {
  const notes = {};
  const me = view.me;
  if (!me) return notes;

  for (const id of me.teammates ?? []) notes[id] = '같은 편';
  for (const { targetId, role } of me.knownJobs ?? []) notes[targetId] = ROLE_LABEL[role] ?? role;
  for (const { targetId, isMafia } of me.investigations ?? []) {
    notes[targetId] = isMafia ? '마피아' : '마피아 아님';
  }
  return notes;
}

function nightReport(view) {
  if (!view.lastNightResult) return null;
  const { killedId } = view.lastNightResult;
  if (!killedId) return '밤 사이 아무도 죽지 않았습니다.';
  const victim = view.players.find((p) => p.id === killedId);
  return `${victim?.nickname ?? '누군가'}님이 밤 사이 사망했습니다.`;
}

export default function Game({ view, messages, game }) {
  const report = view.phase === 'DAY_DISCUSSION' ? nightReport(view) : null;
  const action = nightActionFor(view);
  const nominable = nominateTargets(view);

  // 밤에는 역할 행동으로, 지목 투표 때는 투표로 — 명단 하나에서 다 고른다.
  const selectableIds = action?.selectableIds ?? nominable;
  const selectedId = action
    ? (view.myAction?.targetId ?? null)
    : (view.votes?.[view.me?.id] ?? null);
  const pick = (targetId) => {
    if (action) game.submitAction(action.type, targetId);
    else if (nominable.length > 0) game.nominate(targetId);
  };

  return (
    <main className="game">
      <PhaseBanner
        phase={view.phase}
        day={view.day}
        phaseEndsAt={view.phaseEndsAt}
        onAdjust={game.adjustTime}
        myAdjust={view.myTimeAdjust}
        /* 살아있는 사람만, 한 페이즈에 한 번 */
        canAdjust={Boolean(view.me?.alive) && !view.myTimeAdjust}
      />

      <p className="myrole">
        <span className="myrole__label">내 역할</span>
        <strong className="myrole__value">{ROLE_LABEL[view.me?.role] ?? '?'}</strong>
        {view.me && !view.me.alive && <span className="myrole__dead">사망</span>}
      </p>

      {report && <p className="report">{report}</p>}

      {game.error && <p role="alert" className="error">{errorMessage(game.error)}</p>}

      <ActionPrompt view={view} />
      <VoteBoard view={view} onNominate={game.nominate} onJudge={game.judge} />

      <Roster
        players={view.players}
        me={view.me}
        annotations={annotationsFor(view)}
        voteCounts={voteCountsOf(view)}
        selectableIds={selectableIds}
        selectedId={selectedId}
        onSelect={pick}
        /* 마피아가 겨눈 사람에게만 조준선을 얹는다 */
        selectedMark={
          action?.type === ACTION.MAFIA_KILL ? <Scope className="seat__scope" /> : null
        }
      />

      <ChatPanel view={view} messages={messages} onSend={game.sendChat} />
    </main>
  );
}
