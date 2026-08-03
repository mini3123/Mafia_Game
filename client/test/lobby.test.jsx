import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Lobby from '../src/screens/Lobby.jsx';
import WaitingRoom from '../src/screens/WaitingRoom.jsx';

function makeView(overrides = {}) {
  return {
    code: 'ABC234',
    phase: 'WAITING',
    hostId: 'p1',
    players: [
      { id: 'p1', nickname: '가', alive: true, connected: true, isHost: true, revealedTeam: null },
      { id: 'p2', nickname: '나', alive: true, connected: true, isHost: false, revealedTeam: null },
    ],
    me: {
      id: 'p1', role: null, alive: true,
      teammates: [], investigations: [], knownJobs: [], contactSucceeded: false,
    },
    ...overrides,
  };
}

const fivePlayers = ['가', '나', '다', '라', '마'].map((nickname, i) => ({
  id: `p${i + 1}`, nickname, alive: true, connected: true, isHost: i === 0, revealedTeam: null,
}));

describe('Lobby', () => {
  it('닉네임 없이는 방을 만들 수 없다', () => {
    render(<Lobby onCreate={vi.fn()} onJoin={vi.fn()} error={null} />);
    expect(screen.getByRole('button', { name: '방 만들기' })).toBeDisabled();
  });

  it('닉네임을 넣으면 방을 만들 수 있다', async () => {
    const onCreate = vi.fn();
    render(<Lobby onCreate={onCreate} onJoin={vi.fn()} error={null} />);

    await userEvent.type(screen.getByLabelText('닉네임'), '홍길동');
    await userEvent.click(screen.getByRole('button', { name: '방 만들기' }));

    expect(onCreate).toHaveBeenCalledWith('홍길동');
  });

  it('코드와 닉네임을 넣으면 입장할 수 있다', async () => {
    const onJoin = vi.fn();
    render(<Lobby onCreate={vi.fn()} onJoin={onJoin} error={null} />);

    await userEvent.type(screen.getByLabelText('닉네임'), '홍길동');
    await userEvent.type(screen.getByLabelText('방 코드'), 'abc234');
    await userEvent.click(screen.getByRole('button', { name: '입장하기' }));

    // 코드는 대문자로 정규화해서 보낸다.
    expect(onJoin).toHaveBeenCalledWith('ABC234', '홍길동');
  });

  it('오류 코드를 사람이 읽을 문구로 보여준다', () => {
    render(<Lobby onCreate={vi.fn()} onJoin={vi.fn()} error="NICKNAME_TAKEN" />);
    expect(screen.getByRole('alert')).toHaveTextContent('이미 쓰고 있는 닉네임입니다');
  });

  it('없는 방 오류도 문구로 바뀐다', () => {
    render(<Lobby onCreate={vi.fn()} onJoin={vi.fn()} error="ROOM_NOT_FOUND" />);
    expect(screen.getByRole('alert')).toHaveTextContent('그런 방이 없습니다');
  });
});

describe('WaitingRoom', () => {
  it('방 코드와 참가자를 보여준다', () => {
    render(<WaitingRoom view={makeView()} onStart={vi.fn()} onLeave={vi.fn()} />);
    expect(screen.getByText('ABC234')).toBeInTheDocument();
    expect(screen.getByText('가')).toBeInTheDocument();
    expect(screen.getByText('나')).toBeInTheDocument();
  });

  it('방장에게 표시가 붙는다', () => {
    render(<WaitingRoom view={makeView()} onStart={vi.fn()} onLeave={vi.fn()} />);
    expect(screen.getByLabelText('방장')).toBeInTheDocument();
  });

  it('5명 미만이면 시작 버튼이 잠긴다', () => {
    render(<WaitingRoom view={makeView()} onStart={vi.fn()} onLeave={vi.fn()} />);
    expect(screen.getByRole('button', { name: /시작/ })).toBeDisabled();
    expect(screen.getByText(/5명부터 시작할 수 있습니다/)).toBeInTheDocument();
  });

  it('5명이 모이면 방장이 시작할 수 있다', async () => {
    const onStart = vi.fn();
    render(
      <WaitingRoom view={makeView({ players: fivePlayers })} onStart={onStart} onLeave={vi.fn()} />,
    );

    const button = screen.getByRole('button', { name: /시작/ });
    expect(button).toBeEnabled();
    await userEvent.click(button);
    expect(onStart).toHaveBeenCalled();
  });

  it('방장이 아니면 시작 버튼 대신 안내가 보인다', () => {
    const view = makeView({
      me: { ...makeView().me, id: 'p2' },
      players: fivePlayers,
    });
    render(<WaitingRoom view={view} onStart={vi.fn()} onLeave={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /시작/ })).not.toBeInTheDocument();
    expect(screen.getByText(/방장이 시작하기를 기다리는 중/)).toBeInTheDocument();
  });

  it('자리 번호를 보여준다 — 한국 마피아는 번호로 부른다', () => {
    render(
      <WaitingRoom view={makeView({ players: fivePlayers })} onStart={vi.fn()} onLeave={vi.fn()} />,
    );
    for (const seat of ['1', '2', '3', '4', '5']) {
      expect(screen.getByText(seat)).toBeInTheDocument();
    }
  });
});
