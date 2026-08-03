import { useState } from 'react';
import { errorMessage } from '../errors.js';

export default function Lobby({ onCreate, onJoin, error }) {
  const [nickname, setNickname] = useState('');
  const [code, setCode] = useState('');

  const trimmed = nickname.trim();
  const canCreate = trimmed.length > 0;
  const canJoin = canCreate && code.trim().length === 6;

  return (
    <main className="lobby">
      <header className="lobby__head">
        <p className="eyebrow">5–12명 · 텍스트 토론</p>
        <h1 className="title">마피아</h1>
        <p className="lobby__premise">
          모두가 같은 명단을 봅니다. 다만 각자 아는 것이 다릅니다.
        </p>
      </header>

      {error && <p role="alert" className="error">{errorMessage(error)}</p>}

      <div className="field">
        <label htmlFor="nickname">닉네임</label>
        <input
          id="nickname"
          value={nickname}
          maxLength={12}
          autoComplete="off"
          placeholder="12자 이내"
          onChange={(e) => setNickname(e.target.value)}
        />
      </div>

      <button className="btn btn--primary" disabled={!canCreate} onClick={() => onCreate(trimmed)}>
        방 만들기
      </button>

      <div className="lobby__or">
        <span>또는</span>
      </div>

      <div className="field">
        <label htmlFor="code">방 코드</label>
        <input
          id="code"
          className="input--code"
          value={code}
          maxLength={6}
          autoComplete="off"
          placeholder="6자리"
          onChange={(e) => setCode(e.target.value.toUpperCase())}
        />
      </div>

      <button
        className="btn"
        disabled={!canJoin}
        onClick={() => onJoin(code.trim().toUpperCase(), trimmed)}
      >
        입장하기
      </button>
    </main>
  );
}
