import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PhaseBanner from '../src/components/PhaseBanner.jsx';
import Roster from '../src/components/Roster.jsx';
import { annotationsFor } from '../src/screens/Game.jsx';

const players = [
  { id: 'p1', nickname: '가', alive: true, connected: true, isHost: true, revealedTeam: null },
  { id: 'p2', nickname: '나', alive: true, connected: true, isHost: false, revealedTeam: null },
  { id: 'p3', nickname: '다', alive: false, connected: true, isHost: false, revealedTeam: 'MAFIA' },
  { id: 'p4', nickname: '라', alive: true, connected: false, isHost: false, revealedTeam: null },
];

const me = {
  id: 'p1', role: 'CITIZEN', alive: true,
  teammates: [], investigations: [], knownJobs: [], contactSucceeded: false,
};

describe('PhaseBanner', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  it('페이즈 이름과 날짜를 보여준다', () => {
    vi.setSystemTime(0);
    render(<PhaseBanner phase="NIGHT" day={2} phaseEndsAt={30_000} />);
    expect(screen.getByText('밤')).toBeInTheDocument();
    expect(screen.getByText(/2일차/)).toBeInTheDocument();
  });

  it('남은 시간을 초로 보여준다', () => {
    vi.setSystemTime(0);
    render(<PhaseBanner phase="NIGHT" day={1} phaseEndsAt={30_000} />);
    expect(screen.getByTestId('countdown')).toHaveTextContent('30');
  });

  it('시간이 흐르면 숫자가 줄어든다', async () => {
    vi.setSystemTime(0);
    render(<PhaseBanner phase="NIGHT" day={1} phaseEndsAt={30_000} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
    expect(screen.getByTestId('countdown')).toHaveTextContent('25');
  });

  it('시간이 지나면 0에서 멈춘다', async () => {
    vi.setSystemTime(0);
    render(<PhaseBanner phase="NIGHT" day={1} phaseEndsAt={2_000} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(screen.getByTestId('countdown')).toHaveTextContent('0');
  });

  it('종료 시각이 없으면 타이머를 그리지 않는다', () => {
    render(<PhaseBanner phase="ENDED" day={3} phaseEndsAt={null} />);
    expect(screen.queryByTestId('countdown')).not.toBeInTheDocument();
  });
});

describe('PhaseBanner — 시간 조절', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  const banner = (props) => {
    vi.setSystemTime(0);
    return render(
      <PhaseBanner phase="DAY_DISCUSSION" day={1} phaseEndsAt={120_000} {...props} />,
    );
  };

  it('조절 콜백이 없으면 버튼을 그리지 않는다', () => {
    banner({});
    expect(screen.queryByRole('button', { name: '−20초' })).not.toBeInTheDocument();
  });

  it('단축과 연장 버튼이 나온다', () => {
    banner({ onAdjust: vi.fn(), canAdjust: true });
    expect(screen.getByRole('button', { name: '−20초' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '+20초' })).toBeEnabled();
  });

  it('단축을 누르면 SHORTEN을 보낸다', async () => {
    const onAdjust = vi.fn();
    banner({ onAdjust, canAdjust: true });
    await userEvent.click(screen.getByRole('button', { name: '−20초' }));
    expect(onAdjust).toHaveBeenCalledWith('SHORTEN');
  });

  it('연장을 누르면 EXTEND를 보낸다', async () => {
    const onAdjust = vi.fn();
    banner({ onAdjust, canAdjust: true });
    await userEvent.click(screen.getByRole('button', { name: '+20초' }));
    expect(onAdjust).toHaveBeenCalledWith('EXTEND');
  });

  it('이미 썼으면 버튼이 잠기고 쓴 쪽이 표시된다', () => {
    banner({ onAdjust: vi.fn(), canAdjust: false, myAdjust: 'SHORTEN' });
    expect(screen.getByRole('button', { name: '−20초' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '−20초' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '+20초' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('시간이 없는 페이즈에는 버튼이 없다', () => {
    render(<PhaseBanner phase="ENDED" day={3} phaseEndsAt={null} onAdjust={vi.fn()} canAdjust />);
    expect(screen.queryByRole('button', { name: '−20초' })).not.toBeInTheDocument();
  });
});

describe('Roster', () => {
  const base = {
    players, me, selectableIds: [], selectedId: null,
    onSelect: vi.fn(), annotations: {}, voteCounts: {},
  };

  it('모든 참가자를 자리 번호와 함께 보여준다', () => {
    render(<Roster {...base} />);
    for (const nickname of ['가', '나', '다', '라']) {
      expect(screen.getByText(nickname)).toBeInTheDocument();
    }
    for (const seat of ['1', '2', '3', '4']) {
      expect(screen.getByText(seat)).toBeInTheDocument();
    }
  });

  it('죽은 사람의 진영을 보여준다', () => {
    render(<Roster {...base} />);
    expect(screen.getByText('마피아')).toBeInTheDocument();
  });

  it('살아있는 사람의 진영은 보여주지 않는다', () => {
    render(<Roster {...base} />);
    expect(screen.queryByText('시민')).not.toBeInTheDocument();
  });

  it('연결이 끊긴 사람을 표시한다', () => {
    render(<Roster {...base} />);
    expect(screen.getByLabelText('연결 끊김')).toBeInTheDocument();
  });

  it('고를 수 없는 사람의 버튼은 잠긴다', () => {
    render(<Roster {...base} selectableIds={['p2']} />);
    expect(screen.getByRole('button', { name: /나/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /가/ })).toBeDisabled();
  });

  it('고르면 콜백이 불린다', async () => {
    const onSelect = vi.fn();
    render(<Roster {...base} selectableIds={['p2']} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('button', { name: /나/ }));
    expect(onSelect).toHaveBeenCalledWith('p2');
  });

  it('고른 사람이 표시된다', () => {
    render(<Roster {...base} selectableIds={['p2']} selectedId="p2" />);
    expect(screen.getByRole('button', { name: /나/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('나만 아는 정보를 여백에 적는다', () => {
    render(<Roster {...base} annotations={{ p2: '같은 편' }} />);
    expect(screen.getByText('같은 편')).toBeInTheDocument();
  });

  it('득표 수를 보여준다', () => {
    render(<Roster {...base} voteCounts={{ p2: 3 }} />);
    expect(screen.getByText('3표')).toBeInTheDocument();
  });
});

describe('annotationsFor', () => {
  it('마피아 동료에 표시를 붙인다', () => {
    const view = { players, me: { ...me, role: 'MAFIA', teammates: ['p2'] } };
    expect(annotationsFor(view)).toEqual({ p2: '같은 편' });
  });

  it('스파이가 알아낸 직업을 붙인다', () => {
    const view = {
      players,
      me: { ...me, role: 'SPY', knownJobs: [{ targetId: 'p2', role: 'DOCTOR' }] },
    };
    expect(annotationsFor(view)).toEqual({ p2: '의사' });
  });

  it('경찰 조사 결과를 붙인다', () => {
    const view = {
      players,
      me: {
        ...me, role: 'POLICE',
        investigations: [
          { day: 1, targetId: 'p2', isMafia: true },
          { day: 2, targetId: 'p4', isMafia: false },
        ],
      },
    };
    expect(annotationsFor(view)).toEqual({ p2: '마피아', p4: '마피아 아님' });
  });

  it('시민의 여백은 비어 있다 — 그게 시민의 처지다', () => {
    expect(annotationsFor({ players, me })).toEqual({});
  });
});
