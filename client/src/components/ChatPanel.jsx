import { useEffect, useRef, useState } from 'react';
import { CHANNEL_LABEL } from '../labels.js';

/**
 * 서버 canSend의 거울. 입력창을 잠그기 위한 것이고, 최종 판단은 서버가 한다.
 * 둘이 어긋나면 서버가 이긴다.
 */
export function canSendHere(view, channel) {
  const me = view.me;
  if (!me) return false;

  if (channel === 'GHOST') return !me.alive;
  if (!me.alive) return false;

  if (channel === 'MAFIA') {
    return view.phase === 'NIGHT' && (view.availableChannels ?? []).includes('MAFIA');
  }

  if (channel === 'PUBLIC') {
    if (view.phase === 'DAY_DISCUSSION' || view.phase === 'VOTE_NOMINATE') return true;
    if (view.phase === 'DEFENSE') return view.nominee === me.id;
    return false;
  }

  return false;
}

export default function ChatPanel({ view, messages, onSend }) {
  const channels = view.availableChannels ?? ['PUBLIC'];
  const [channel, setChannel] = useState(channels[0]);
  const [draft, setDraft] = useState('');
  const logRef = useRef(null);

  // 죽으면 유령 탭이 새로 생긴다. 사라진 탭에 머무르지 않게 되돌린다.
  useEffect(() => {
    if (!channels.includes(channel)) setChannel(channels[0]);
  }, [channels, channel]);

  const shown = messages.filter((m) => m.channel === channel);

  // 채팅 상자 안에서만 내린다. scrollIntoView를 쓰면 페이지 전체가 튄다.
  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [shown.length, channel]);

  const enabled = canSendHere(view, channel);

  const submit = (event) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    onSend(channel, text);
    setDraft('');
  };

  return (
    <section className={`chat chat--${channel.toLowerCase()}`}>
      <div role="tablist" className="chat__tabs">
        {channels.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            className="chat__tab"
            aria-selected={name === channel}
            onClick={() => setChannel(name)}
          >
            {CHANNEL_LABEL[name] ?? name}
          </button>
        ))}
      </div>

      <ol className="chat__log" ref={logRef}>
        {shown.length === 0 && <li className="chat__empty">아직 오간 말이 없습니다.</li>}
        {shown.map((m, index) => (
          <li key={`${m.at}-${index}`} className="chat__line">
            <span className="chat__who">{m.senderName}</span>
            <span className="chat__what">{m.text}</span>
          </li>
        ))}
      </ol>

      <form onSubmit={submit} className="chat__form">
        <input
          type="text"
          value={draft}
          disabled={!enabled}
          maxLength={300}
          autoComplete="off"
          placeholder={enabled ? '메시지를 입력하세요' : '지금은 말할 수 없습니다'}
          onChange={(e) => setDraft(e.target.value)}
        />
      </form>
    </section>
  );
}
