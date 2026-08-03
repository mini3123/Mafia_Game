import { useGame } from './hooks/useGame.js';
import Lobby from './screens/Lobby.jsx';
import WaitingRoom from './screens/WaitingRoom.jsx';
import Game from './screens/Game.jsx';
import Result from './screens/Result.jsx';

/** 낮에는 종이 위의 기록, 밤에는 잉크빛 어둠. 빛의 양이 곧 정보의 양이다. */
const DAYLIGHT_PHASES = new Set(['DAY_DISCUSSION', 'VOTE_NOMINATE', 'DEFENSE', 'VOTE_JUDGE']);

export default function App() {
  const game = useGame();
  const { view } = game;

  const daylight = Boolean(view) && DAYLIGHT_PHASES.has(view.phase);

  return (
    <div className="stage" data-daylight={String(daylight)}>
      {!view && <Lobby onCreate={game.createRoom} onJoin={game.joinRoom} error={game.error} />}

      {view?.phase === 'WAITING' && (
        <WaitingRoom view={view} onStart={game.start} onLeave={game.leave} />
      )}

      {view?.phase === 'ENDED' && view.result && (
        <Result view={view} onRestart={game.restart} onLeave={game.leave} />
      )}

      {view && view.phase !== 'WAITING' && view.phase !== 'ENDED' && (
        <Game view={view} messages={game.messages} game={game} />
      )}
    </div>
  );
}
