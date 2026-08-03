import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const SESSION_KEY = 'mafia:session';

const loadSession = () => {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY));
  } catch {
    return null;
  }
};
const saveSession = (session) => localStorage.setItem(SESSION_KEY, JSON.stringify(session));
const clearSession = () => localStorage.removeItem(SESSION_KEY);

export function useGame({ createSocket = () => io() } = {}) {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [view, setView] = useState(null);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState(null);

  if (socketRef.current === null) socketRef.current = createSocket();

  useEffect(() => {
    const socket = socketRef.current;

    const onConnect = () => {
      setConnected(true);
      const session = loadSession();
      // 새로고침 복구: 소켓 id가 아니라 저장해둔 플레이어 토큰으로 원래 자리에 붙는다.
      if (session?.code && session?.playerId) {
        socket.emit('room:rejoin', session, (result) => {
          if (result && result.ok === false) {
            clearSession();
            setError(result.code);
          }
        });
      }
    };
    const onDisconnect = () => setConnected(false);
    const onState = (next) => setView(next);
    const onMessage = (message) => setMessages((prev) => [...prev, message]);
    const onHistory = (history) => setMessages(history ?? []);
    const onError = (payload) => setError(payload?.code ?? 'UNKNOWN');

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('state:update', onState);
    socket.on('chat:message', onMessage);
    socket.on('chat:history', onHistory);
    socket.on('error', onError);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('state:update', onState);
      socket.off('chat:message', onMessage);
      socket.off('chat:history', onHistory);
      socket.off('error', onError);
    };
  }, []);

  const enter = useCallback((event, payload) => {
    setError(null);
    return new Promise((resolve) => {
      socketRef.current.emit(event, payload, (result) => {
        if (result?.ok) {
          saveSession({ code: result.code, playerId: result.playerId });
        } else {
          setError(result?.code ?? 'UNKNOWN');
        }
        resolve(result);
      });
    });
  }, []);

  const createRoom = useCallback((nickname) => enter('room:create', { nickname }), [enter]);
  const joinRoom = useCallback(
    (code, nickname) => enter('room:join', { code, nickname }),
    [enter],
  );

  const leave = useCallback(() => {
    clearSession();
    setView(null);
    setMessages([]);
    setError(null);
    socketRef.current.disconnect();
  }, []);

  const start = useCallback(() => socketRef.current.emit('game:start'), []);
  const restart = useCallback(() => socketRef.current.emit('game:restart'), []);
  const submitAction = useCallback(
    (type, targetId) => socketRef.current.emit('action:submit', { type, targetId }),
    [],
  );
  const nominate = useCallback(
    (targetId) => socketRef.current.emit('vote:nominate', { targetId: targetId ?? null }),
    [],
  );
  const judge = useCallback(
    (approve) => socketRef.current.emit('vote:judge', { approve }),
    [],
  );
  const adjustTime = useCallback(
    (direction) => socketRef.current.emit('time:adjust', { direction }),
    [],
  );
  const sendChat = useCallback((channel, text) => {
    const body = String(text ?? '').trim();
    if (!body) return;
    socketRef.current.emit('chat:send', { channel, text: body });
  }, []);

  return {
    connected, view, messages, error,
    createRoom, joinRoom, leave,
    start, restart, submitAction, nominate, judge, adjustTime, sendChat,
  };
}
