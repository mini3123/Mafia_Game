import { useGame } from './hooks/useGame.js';

export default function App() {
  const game = useGame();
  return (
    <div className="stage" data-daylight="false">
      <main style={{ padding: 24 }}>
        <h1>마피아</h1>
        <p>{game.connected ? '서버에 연결됨' : '연결 중…'}</p>
      </main>
    </div>
  );
}
