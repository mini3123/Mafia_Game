import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Result from '../src/screens/Result.jsx';

const players = [
  { id: 'p1', nickname: '가', alive: false, connected: true, isHost: true, revealedTeam: 'MAFIA' },
  { id: 'p2', nickname: '나', alive: true, connected: true, isHost: false, revealedTeam: null },
  { id: 'p3', nickname: '다', alive: true, connected: true, isHost: false, revealedTeam: null },
];

function view(winner, meId = 'p2') {
  const roles = { p1: 'MAFIA', p2: 'DOCTOR', p3: 'SPY' };
  return {
    phase: 'ENDED', day: 3, players, hostId: 'p1',
    me: {
      id: meId, role: roles[meId], alive: true,
      teammates: [], investigations: [], knownJobs: [], contactSucceeded: false,
    },
    result: {
      winner,
      roles: Object.entries(roles).map(([id, role]) => ({ id, role })),
    },
  };
}

describe('Result', () => {
  it('시민 승리를 알린다', () => {
    render(<Result view={view('CITIZEN')} onRestart={vi.fn()} onLeave={vi.fn()} />);
    expect(screen.getByText('시민 승리')).toBeInTheDocument();
  });

  it('마피아 승리를 알린다', () => {
    render(<Result view={view('MAFIA')} onRestart={vi.fn()} onLeave={vi.fn()} />);
    expect(screen.getByText('마피아 승리')).toBeInTheDocument();
  });

  it('전원의 정확한 직업을 공개한다', () => {
    render(<Result view={view('CITIZEN')} onRestart={vi.fn()} onLeave={vi.fn()} />);
    expect(screen.getByText('마피아')).toBeInTheDocument();
    expect(screen.getByText('의사')).toBeInTheDocument();
    expect(screen.getByText('스파이')).toBeInTheDocument();
  });

  it('내가 이겼는지 알려준다', () => {
    render(<Result view={view('CITIZEN', 'p2')} onRestart={vi.fn()} onLeave={vi.fn()} />);
    expect(screen.getByText('당신은 이겼습니다')).toBeInTheDocument();
  });

  it('스파이는 마피아가 이겼을 때 함께 이긴다', () => {
    render(<Result view={view('MAFIA', 'p3')} onRestart={vi.fn()} onLeave={vi.fn()} />);
    expect(screen.getByText('당신은 이겼습니다')).toBeInTheDocument();
  });

  it('스파이는 마피아가 지면 함께 진다', () => {
    render(<Result view={view('CITIZEN', 'p3')} onRestart={vi.fn()} onLeave={vi.fn()} />);
    expect(screen.getByText('당신은 졌습니다')).toBeInTheDocument();
  });

  it('방장에게만 다시 하기 버튼이 보인다', () => {
    render(<Result view={view('CITIZEN', 'p1')} onRestart={vi.fn()} onLeave={vi.fn()} />);
    expect(screen.getByRole('button', { name: '다시 하기' })).toBeInTheDocument();
  });

  it('방장이 아니면 안내만 보인다', () => {
    render(<Result view={view('CITIZEN', 'p2')} onRestart={vi.fn()} onLeave={vi.fn()} />);
    expect(screen.queryByRole('button', { name: '다시 하기' })).not.toBeInTheDocument();
    expect(screen.getByText(/방장이 다시 시작하기를 기다리는 중/)).toBeInTheDocument();
  });

  it('다시 하기를 누르면 콜백이 불린다', async () => {
    const onRestart = vi.fn();
    render(<Result view={view('CITIZEN', 'p1')} onRestart={onRestart} onLeave={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: '다시 하기' }));
    expect(onRestart).toHaveBeenCalled();
  });

  it('나가기를 누르면 콜백이 불린다', async () => {
    const onLeave = vi.fn();
    render(<Result view={view('CITIZEN', 'p2')} onRestart={vi.fn()} onLeave={onLeave} />);
    await userEvent.click(screen.getByRole('button', { name: '나가기' }));
    expect(onLeave).toHaveBeenCalled();
  });

  it('자리 번호와 함께 보여준다', () => {
    render(<Result view={view('CITIZEN')} onRestart={vi.fn()} onLeave={vi.fn()} />);
    for (const seat of ['1', '2', '3']) {
      expect(screen.getByText(seat)).toBeInTheDocument();
    }
  });
});
