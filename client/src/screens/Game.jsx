import PhaseBanner from '../components/PhaseBanner.jsx';
import Roster from '../components/Roster.jsx';
import ActionPrompt, { ACTION, nightActionFor } from '../components/ActionPrompt.jsx';
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

export default function Game({ view, game }) {
  const report = view.phase === 'DAY_DISCUSSION' ? nightReport(view) : null;
  const action = nightActionFor(view);

  return (
    <main className="game">
      <PhaseBanner phase={view.phase} day={view.day} phaseEndsAt={view.phaseEndsAt} />

      <p className="myrole">
        <span className="myrole__label">내 역할</span>
        <strong className="myrole__value">{ROLE_LABEL[view.me?.role] ?? '?'}</strong>
        {view.me && !view.me.alive && <span className="myrole__dead">사망</span>}
      </p>

      {report && <p className="report">{report}</p>}

      {game.error && <p role="alert" className="error">{errorMessage(game.error)}</p>}

      <ActionPrompt view={view} />

      <Roster
        players={view.players}
        me={view.me}
        annotations={annotationsFor(view)}
        selectableIds={action?.selectableIds ?? []}
        selectedId={view.myAction?.targetId ?? null}
        onSelect={(targetId) => action && game.submitAction(action.type, targetId)}
        /* 마피아가 겨눈 사람에게만 조준선을 얹는다 */
        selectedMark={
          action?.type === ACTION.MAFIA_KILL ? <Scope className="seat__scope" /> : null
        }
      />

      {/* 투표는 Task 17, 채팅은 Task 18에서 붙인다. */}
    </main>
  );
}
