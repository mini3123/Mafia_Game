import { useEffect, useMemo, useRef, useState } from 'react';
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

/**
 * 연달아 말한 것은 한 덩어리로 묶는다. 같은 이름이 세 줄 연속 반복되면
 * 읽는 눈이 이름만 훑게 되어 정작 내용이 안 들어온다.
 */
function groupMessages(messages) {
  const groups = [];
  for (const message of messages) {
    const last = groups[groups.length - 1];
    if (!message.system && last && !last.system && last.senderId === message.senderId) {
      last.texts.push(message.text);
    } else {
      groups.push({
        system: Boolean(message.system),
        senderId: message.senderId,
        senderName: message.senderName,
        at: message.at,
        texts: [message.text],
      });
    }
  }
  return groups;
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

  const shown = useMemo(
    () => messages.filter((m) => m.channel === channel),
    [messages, channel],
  );
  const groups = useMemo(() => groupMessages(shown), [shown]);

  // 자리 번호로 서로를 부르므로 채팅에도 번호를 붙인다.
  const seatOf = useMemo(
    () => new Map(view.players.map((p, index) => [p.id, index + 1])),
    [view.players],
  );

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
        {groups.length === 0 && <li className="chat__empty">아직 오간 말이 없습니다.</li>}

        {groups.map((group, index) =>
          group.system ? (
            <li key={`${group.at}-${index}`} className="chat__system">
              {group.texts[0]}
            </li>
          ) : (
            <li
              key={`${group.at}-${index}`}
              className={`chat__group${group.senderId === view.me?.id ? ' chat__group--mine' : ''}`}
            >
              <p className="chat__who">
                <span className="chat__seat">{String(seatOf.get(group.senderId) ?? '?')}</span>
                <span className="chat__name">{group.senderName}</span>
              </p>
              {group.texts.map((text, i) => (
                <p key={i} className="chat__what">{text}</p>
              ))}
            </li>
          ),
        )}
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
