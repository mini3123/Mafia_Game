import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useGame } from '../src/hooks/useGame.js';

/** 서버 없이 훅을 시험하기 위한 가짜 소켓. */
function makeFakeSocket() {
  const handlers = new Map();
  const sent = [];
  return {
    sent,
    on(event, fn) { handlers.set(event, fn); },
    off(event) { handlers.delete(event); },
    emit(event, payload, ack) {
      sent.push({ event, payload });
      if (typeof ack === 'function') this.nextAck?.(event, payload, ack);
    },
    disconnect() { sent.push({ event: '__disconnect' }); },
    // 테스트에서 서버가 보낸 것처럼 흉내낸다.
    fire(event, payload) { act(() => handlers.get(event)?.(payload)); },
    nextAck: null,
  };
}

const renderGame = (socket) =>
  renderHook(() => useGame({ createSocket: () => socket }));

beforeEach(() => localStorage.clear());

describe('useGame — 연결', () => {
  it('처음에는 연결되지 않은 상태다', () => {
    const { result } = renderGame(makeFakeSocket());
    expect(result.current.connected).toBe(false);
    expect(result.current.view).toBeNull();
  });

  it('connect 이벤트로 연결 상태가 켜진다', () => {
    const socket = makeFakeSocket();
    const { result } = renderGame(socket);
    socket.fire('connect');
    expect(result.current.connected).toBe(true);
  });

  it('state:update를 받으면 view가 갱신된다', () => {
    const socket = makeFakeSocket();
    const { result } = renderGame(socket);
    socket.fire('state:update', { phase: 'NIGHT', day: 1, players: [] });
    expect(result.current.view.phase).toBe('NIGHT');
  });
});

describe('useGame — 방 만들기와 세션 저장', () => {
  it('성공하면 세션을 localStorage에 저장한다', async () => {
    const socket = makeFakeSocket();
    socket.nextAck = (event, payload, ack) => ack({
      ok: true, code: 'ABC234', playerId: 'pid-1', resumeToken: 'secret-1',
    });
    const { result } = renderGame(socket);

    await act(async () => { await result.current.createRoom('나'); });

    expect(JSON.parse(localStorage.getItem('mafia:session')))
      .toEqual({ code: 'ABC234', resumeToken: 'secret-1' });
  });

  it('실패하면 오류 코드를 보관하고 세션을 저장하지 않는다', async () => {
    const socket = makeFakeSocket();
    socket.nextAck = (event, payload, ack) => ack({ ok: false, code: 'NICKNAME_TAKEN' });
    const { result } = renderGame(socket);

    await act(async () => { await result.current.joinRoom('ABC234', '나'); });

    expect(result.current.error).toBe('NICKNAME_TAKEN');
    expect(localStorage.getItem('mafia:session')).toBeNull();
  });

  it('저장된 세션이 있으면 뜨자마자 재입장을 시도한다', () => {
    localStorage.setItem('mafia:session', JSON.stringify({
      code: 'ABC234', resumeToken: 'secret-1',
    }));
    const socket = makeFakeSocket();
    renderGame(socket);
    socket.fire('connect');
    expect(socket.sent).toContainEqual({
      event: 'room:rejoin',
      payload: { code: 'ABC234', resumeToken: 'secret-1' },
    });
  });
});

describe('useGame — 행동 전송', () => {
  it('밤 행동을 그대로 보낸다', () => {
    const socket = makeFakeSocket();
    const { result } = renderGame(socket);
    act(() => result.current.submitAction('MAFIA_KILL', 'p3'));
    expect(socket.sent).toContainEqual({
      event: 'action:submit',
      payload: { type: 'MAFIA_KILL', targetId: 'p3' },
    });
  });

  it('기권은 targetId를 null로 보낸다', () => {
    const socket = makeFakeSocket();
    const { result } = renderGame(socket);
    act(() => result.current.nominate(null));
    expect(socket.sent).toContainEqual({ event: 'vote:nominate', payload: { targetId: null } });
  });

  it('찬반 투표를 보낸다', () => {
    const socket = makeFakeSocket();
    const { result } = renderGame(socket);
    act(() => result.current.judge(true));
    expect(socket.sent).toContainEqual({ event: 'vote:judge', payload: { approve: true } });
  });

  it('다시 하기를 보낸다', () => {
    const socket = makeFakeSocket();
    const { result } = renderGame(socket);
    act(() => result.current.restart());
    expect(socket.sent).toContainEqual({ event: 'game:restart', payload: undefined });
  });

  it('빈 채팅은 보내지 않는다', () => {
    const socket = makeFakeSocket();
    const { result } = renderGame(socket);
    act(() => result.current.sendChat('PUBLIC', '   '));
    expect(socket.sent.filter((s) => s.event === 'chat:send')).toEqual([]);
  });
});

describe('useGame — 채팅 수신', () => {
  it('받은 메시지가 쌓인다', () => {
    const socket = makeFakeSocket();
    const { result } = renderGame(socket);
    socket.fire('chat:message', { channel: 'PUBLIC', senderName: '가', text: '안녕', at: 1 });
    socket.fire('chat:message', { channel: 'PUBLIC', senderName: '나', text: '반가워', at: 2 });
    expect(result.current.messages).toHaveLength(2);
  });

  it('재접속 시 받은 기록이 목록을 대체한다', () => {
    const socket = makeFakeSocket();
    const { result } = renderGame(socket);
    socket.fire('chat:message', { channel: 'PUBLIC', senderName: '가', text: '옛날', at: 1 });
    socket.fire('chat:history', [{ channel: 'PUBLIC', senderName: '나', text: '복구', at: 2 }]);
    expect(result.current.messages).toEqual([
      { channel: 'PUBLIC', senderName: '나', text: '복구', at: 2 },
    ]);
  });
});

describe('useGame — 오류', () => {
  it('서버 오류 코드를 보관한다', () => {
    const socket = makeFakeSocket();
    const { result } = renderGame(socket);
    socket.fire('error', { code: 'CHAT_BLOCKED' });
    expect(result.current.error).toBe('CHAT_BLOCKED');
  });

  it('leave하면 세션을 지우고 상태를 비운다', async () => {
    localStorage.setItem('mafia:session', JSON.stringify({
      code: 'ABC234', resumeToken: 'secret-1',
    }));
    const socket = makeFakeSocket();
    const { result } = renderGame(socket);
    socket.fire('state:update', { phase: 'WAITING', players: [] });

    act(() => result.current.leave());

    await waitFor(() => expect(result.current.view).toBeNull());
    expect(localStorage.getItem('mafia:session')).toBeNull();
    expect(socket.sent).toContainEqual({ event: 'room:leave', payload: undefined });
    expect(socket.sent).not.toContainEqual({ event: '__disconnect' });
  });
});
