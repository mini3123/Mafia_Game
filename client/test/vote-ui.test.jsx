import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VoteBoard, { voteCountsOf, nominateTargets } from '../src/components/VoteBoard.jsx';

const players = [
  { id: 'p1', nickname: '가', alive: true, connected: true, isHost: true, revealedTeam: null },
  { id: 'p2', nickname: '나', alive: true, connected: true, isHost: false, revealedTeam: null },
  { id: 'p3', nickname: '다', alive: true, connected: true, isHost: false, revealedTeam: null },
  { id: 'p4', nickname: '라', alive: false, connected: true, isHost: false, revealedTeam: 'CITIZEN' },
];

function view(phase, overrides = {}) {
  return {
    phase, day: 1, players,
    me: {
      id: 'p1', role: 'CITIZEN', alive: true,
      teammates: [], investigations: [], knownJobs: [], contactSucceeded: false,
    },
    nominee: null, votes: {}, judgeVotes: {},
    ...overrides,
  };
}

describe('voteCountsOf', () => {
  it('지목 투표 득표를 센다', () => {
    const v = view('VOTE_NOMINATE', { votes: { p1: 'p3', p2: 'p3', p3: 'p2' } });
    expect(voteCountsOf(v)).toEqual({ p3: 2, p2: 1 });
  });

  it('기권표는 세지 않는다', () => {
    const v = view('VOTE_NOMINATE', { votes: { p1: null, p2: 'p3' } });
    expect(voteCountsOf(v)).toEqual({ p3: 1 });
  });

  it('투표 페이즈가 아니면 빈 객체다', () => {
    expect(voteCountsOf(view('NIGHT'))).toEqual({});
  });
});

describe('nominateTargets', () => {
  it('살아있고 자신이 아닌 사람만 고를 수 있다', () => {
    expect(nominateTargets(view('VOTE_NOMINATE'))).toEqual(['p2', 'p3']);
  });

  it('죽은 사람은 투표할 수 없으니 대상도 없다', () => {
    const v = view('VOTE_NOMINATE');
    v.me.alive = false;
    expect(nominateTargets(v)).toEqual([]);
  });

  it('지목 투표가 아니면 대상이 없다', () => {
    expect(nominateTargets(view('DEFENSE'))).toEqual([]);
  });
});

describe('VoteBoard — 지목 투표', () => {
  it('기권할 수 있다', async () => {
    const onNominate = vi.fn();
    render(<VoteBoard view={view('VOTE_NOMINATE')} onNominate={onNominate} onJudge={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: '기권' }));
    expect(onNominate).toHaveBeenCalledWith(null);
  });

  it('누가 누구를 찍었는지 보여준다', () => {
    const v = view('VOTE_NOMINATE', { votes: { p2: 'p3' } });
    render(<VoteBoard view={v} onNominate={vi.fn()} onJudge={vi.fn()} />);
    expect(screen.getByText('나 → 다')).toBeInTheDocument();
  });

  it('기권한 사람도 기록에 남는다', () => {
    const v = view('VOTE_NOMINATE', { votes: { p2: null } });
    render(<VoteBoard view={v} onNominate={vi.fn()} onJudge={vi.fn()} />);
    expect(screen.getByText('나 → 기권')).toBeInTheDocument();
  });

  it('죽은 사람에게는 기권 버튼이 없다', () => {
    const v = view('VOTE_NOMINATE');
    v.me.alive = false;
    render(<VoteBoard view={v} onNominate={vi.fn()} onJudge={vi.fn()} />);
    expect(screen.queryByRole('button', { name: '기권' })).not.toBeInTheDocument();
  });
});

describe('VoteBoard — 최후 변론', () => {
  it('지목된 사람을 알려준다', () => {
    const v = view('DEFENSE', { nominee: 'p2' });
    render(<VoteBoard view={v} onNominate={vi.fn()} onJudge={vi.fn()} />);
    expect(screen.getByText(/나님의 최후 변론/)).toBeInTheDocument();
  });

  it('당사자에게는 변론하라고 안내한다', () => {
    const v = view('DEFENSE', { nominee: 'p1' });
    render(<VoteBoard view={v} onNominate={vi.fn()} onJudge={vi.fn()} />);
    expect(screen.getByText(/지금 변론하세요/)).toBeInTheDocument();
  });

  it('나머지에게는 들으라고 안내한다', () => {
    const v = view('DEFENSE', { nominee: 'p2' });
    render(<VoteBoard view={v} onNominate={vi.fn()} onJudge={vi.fn()} />);
    expect(screen.getByText(/지목된 사람만 말할 수 있습니다/)).toBeInTheDocument();
  });
});

describe('VoteBoard — 찬반 투표', () => {
  it('찬성과 반대 버튼이 나온다', () => {
    const v = view('VOTE_JUDGE', { nominee: 'p2' });
    render(<VoteBoard view={v} onNominate={vi.fn()} onJudge={vi.fn()} />);
    expect(screen.getByRole('button', { name: '찬성' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '반대' })).toBeInTheDocument();
  });

  it('찬성을 누르면 true를 보낸다', async () => {
    const onJudge = vi.fn();
    const v = view('VOTE_JUDGE', { nominee: 'p2' });
    render(<VoteBoard view={v} onNominate={vi.fn()} onJudge={onJudge} />);
    await userEvent.click(screen.getByRole('button', { name: '찬성' }));
    expect(onJudge).toHaveBeenCalledWith(true);
  });

  it('반대를 누르면 false를 보낸다', async () => {
    const onJudge = vi.fn();
    const v = view('VOTE_JUDGE', { nominee: 'p2' });
    render(<VoteBoard view={v} onNominate={vi.fn()} onJudge={onJudge} />);
    await userEvent.click(screen.getByRole('button', { name: '반대' }));
    expect(onJudge).toHaveBeenCalledWith(false);
  });

  it('지목 당사자는 투표할 수 없다', () => {
    const v = view('VOTE_JUDGE', { nominee: 'p1' });
    render(<VoteBoard view={v} onNominate={vi.fn()} onJudge={vi.fn()} />);
    expect(screen.queryByRole('button', { name: '찬성' })).not.toBeInTheDocument();
    expect(screen.getByText(/당신의 처형 여부를 투표하는 중/)).toBeInTheDocument();
  });

  it('찬반 집계를 보여준다', () => {
    const v = view('VOTE_JUDGE', { nominee: 'p2', judgeVotes: { p1: true, p3: false } });
    render(<VoteBoard view={v} onNominate={vi.fn()} onJudge={vi.fn()} />);
    expect(screen.getByText('찬성 1 · 반대 1')).toBeInTheDocument();
  });

  it('찬성이 반대보다 많아야 처형된다고 알려준다', () => {
    const v = view('VOTE_JUDGE', { nominee: 'p2' });
    render(<VoteBoard view={v} onNominate={vi.fn()} onJudge={vi.fn()} />);
    expect(screen.getByText(/찬성이 반대보다 많아야/)).toBeInTheDocument();
  });
});

describe('VoteBoard — 그 외', () => {
  it('밤에는 아무것도 그리지 않는다', () => {
    const { container } = render(
      <VoteBoard view={view('NIGHT')} onNominate={vi.fn()} onJudge={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
