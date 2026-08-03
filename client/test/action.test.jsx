import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ActionPrompt, { nightActionFor } from '../src/components/ActionPrompt.jsx';

const players = [
  { id: 'p1', nickname: '가', alive: true, connected: true, isHost: true, revealedTeam: null },
  { id: 'p2', nickname: '나', alive: true, connected: true, isHost: false, revealedTeam: null },
  { id: 'p3', nickname: '다', alive: true, connected: true, isHost: false, revealedTeam: null },
  { id: 'p4', nickname: '라', alive: false, connected: true, isHost: false, revealedTeam: 'CITIZEN' },
];

function view(role, overrides = {}) {
  return {
    phase: 'NIGHT', day: 1, players,
    me: {
      id: 'p1', role, alive: true,
      teammates: role === 'MAFIA' ? ['p2'] : [],
      investigations: [], knownJobs: [], contactSucceeded: false,
    },
    myAction: null,
    ...overrides,
  };
}

describe('nightActionFor', () => {
  it('마피아는 동료와 죽은 사람을 고를 수 없다', () => {
    expect(nightActionFor(view('MAFIA')).selectableIds).toEqual(['p3']);
  });

  it('의사는 자신을 포함해 살아있는 전원을 고를 수 있다', () => {
    expect(nightActionFor(view('DOCTOR')).selectableIds).toEqual(['p1', 'p2', 'p3']);
  });

  it('경찰은 자신을 뺀 살아있는 사람을 고른다', () => {
    expect(nightActionFor(view('POLICE')).selectableIds).toEqual(['p2', 'p3']);
  });

  it('스파이도 자신을 뺀 살아있는 사람을 고른다', () => {
    expect(nightActionFor(view('SPY')).selectableIds).toEqual(['p2', 'p3']);
  });

  it('행동 타입이 서버 규약과 맞는다', () => {
    expect(nightActionFor(view('MAFIA')).type).toBe('MAFIA_KILL');
    expect(nightActionFor(view('DOCTOR')).type).toBe('DOCTOR_SAVE');
    expect(nightActionFor(view('POLICE')).type).toBe('POLICE_CHECK');
    expect(nightActionFor(view('SPY')).type).toBe('SPY_CONTACT');
  });

  it('시민은 행동이 없다', () => {
    expect(nightActionFor(view('CITIZEN'))).toBeNull();
  });

  it('접선에 성공한 스파이도 다른 사람을 조사할 수 있다', () => {
    const v = view('SPY');
    v.me.contactSucceeded = true;
    expect(nightActionFor(v).selectableIds).toEqual(['p2', 'p3']);
  });

  it('죽은 사람은 행동이 없다', () => {
    const v = view('MAFIA');
    v.me.alive = false;
    expect(nightActionFor(v)).toBeNull();
  });

  it('밤이 아니면 행동이 없다', () => {
    expect(nightActionFor(view('MAFIA', { phase: 'DAY_DISCUSSION' }))).toBeNull();
  });
});

describe('ActionPrompt', () => {
  it('마피아에게 지목 안내를 보여준다', () => {
    render(<ActionPrompt view={view('MAFIA')} />);
    expect(screen.getByText(/누구를 제거할까요/)).toBeInTheDocument();
  });

  it('의사에게 자신도 지킬 수 있다고 알려준다', () => {
    render(<ActionPrompt view={view('DOCTOR')} />);
    expect(screen.getByText(/자기 자신도 고를 수 있습니다/)).toBeInTheDocument();
  });

  it('경찰에게 마피아 여부만 알 수 있다고 알려준다', () => {
    render(<ActionPrompt view={view('POLICE')} />);
    expect(screen.getByText(/마피아인지 아닌지만/)).toBeInTheDocument();
  });

  it('스파이에게 정확한 직업을 알게 된다고 알려준다', () => {
    render(<ActionPrompt view={view('SPY')} />);
    expect(screen.getByText(/정확한 직업을 알게 됩니다/)).toBeInTheDocument();
  });

  it('시민에게는 기다리라고 안내한다', () => {
    render(<ActionPrompt view={view('CITIZEN')} />);
    expect(screen.getByText(/아침을 기다리세요/)).toBeInTheDocument();
  });

  it('접선에 성공한 스파이에게 다음 조사 안내를 보여준다', () => {
    const v = view('SPY');
    v.me.contactSucceeded = true;
    render(<ActionPrompt view={v} />);
    expect(screen.getByText(/누구의 직업을 조사할까요/)).toBeInTheDocument();
  });

  it('스파이가 이번 밤 조사했다면 더 고를 수 없다', () => {
    const v = view('SPY', { myAction: { type: 'SPY_CONTACT', targetId: 'p2' } });
    v.me.contactSucceeded = true;
    expect(nightActionFor(v).selectableIds).toEqual([]);
    render(<ActionPrompt view={v} />);
    expect(screen.getByText(/오늘 조사를 마쳤습니다/)).toBeInTheDocument();
  });

  it('죽은 사람에게는 유령 채팅만 쓸 수 있다고 알려준다', () => {
    const v = view('MAFIA');
    v.me.alive = false;
    render(<ActionPrompt view={v} />);
    expect(screen.getByText(/유령 채팅만/)).toBeInTheDocument();
  });

  it('이미 골랐으면 누구를 골랐는지 알려준다', () => {
    const v = view('DOCTOR', { myAction: { type: 'DOCTOR_SAVE', targetId: 'p2' } });
    render(<ActionPrompt view={v} />);
    expect(screen.getByText(/나님을 골랐습니다/)).toBeInTheDocument();
  });

  it('밤이 아니면 아무것도 그리지 않는다', () => {
    const { container } = render(<ActionPrompt view={view('MAFIA', { phase: 'VOTE_NOMINATE' })} />);
    expect(container).toBeEmptyDOMElement();
  });
});
