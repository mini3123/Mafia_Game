import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatPanel, { canSendHere } from '../src/components/ChatPanel.jsx';

function view(phase, overrides = {}) {
  return {
    phase, day: 1, nominee: null,
    players: [
      { id: 'p1', nickname: '가', alive: true, connected: true, isHost: true, revealedTeam: null },
      { id: 'p2', nickname: '나', alive: true, connected: true, isHost: false, revealedTeam: null },
      { id: 'p3', nickname: '다', alive: true, connected: true, isHost: false, revealedTeam: null },
    ],
    me: {
      id: 'p1', role: 'CITIZEN', alive: true,
      teammates: [], investigations: [], knownJobs: [], contactSucceeded: false,
    },
    availableChannels: ['PUBLIC'],
    ...overrides,
  };
}

const messages = [
  { channel: 'PUBLIC', senderId: 'p1', senderName: '가', text: '안녕', at: 1 },
  { channel: 'MAFIA', senderId: 'p2', senderName: '나', text: '3번 치자', at: 2 },
  { channel: 'GHOST', senderId: 'p3', senderName: '다', text: '억울해', at: 3 },
];

describe('canSendHere', () => {
  it('낮 토론에는 전체 채팅이 열린다', () => {
    expect(canSendHere(view('DAY_DISCUSSION'), 'PUBLIC')).toBe(true);
  });

  it('지목 투표 중에도 열린다', () => {
    expect(canSendHere(view('VOTE_NOMINATE'), 'PUBLIC')).toBe(true);
  });

  it('밤에는 전체 채팅이 막힌다', () => {
    expect(canSendHere(view('NIGHT'), 'PUBLIC')).toBe(false);
  });

  it('찬반 투표 중에는 막힌다', () => {
    expect(canSendHere(view('VOTE_JUDGE'), 'PUBLIC')).toBe(false);
  });

  it('최후 변론에는 당사자만 열린다', () => {
    expect(canSendHere(view('DEFENSE', { nominee: 'p1' }), 'PUBLIC')).toBe(true);
    expect(canSendHere(view('DEFENSE', { nominee: 'p2' }), 'PUBLIC')).toBe(false);
  });

  it('마피아 채널은 밤에만 열린다', () => {
    const mafia = { availableChannels: ['PUBLIC', 'MAFIA'] };
    expect(canSendHere(view('NIGHT', mafia), 'MAFIA')).toBe(true);
    expect(canSendHere(view('DAY_DISCUSSION', mafia), 'MAFIA')).toBe(false);
  });

  it('마피아 채널을 못 받는 사람은 밤에도 못 쓴다', () => {
    expect(canSendHere(view('NIGHT'), 'MAFIA')).toBe(false);
  });

  it('유령 채널은 죽은 사람에게 언제나 열린다', () => {
    const dead = view('NIGHT', { availableChannels: ['PUBLIC', 'GHOST'] });
    dead.me.alive = false;
    expect(canSendHere(dead, 'GHOST')).toBe(true);
  });

  it('죽은 사람은 전체 채팅에 말할 수 없다', () => {
    const dead = view('DAY_DISCUSSION');
    dead.me.alive = false;
    expect(canSendHere(dead, 'PUBLIC')).toBe(false);
  });

  it('살아있는 사람은 유령 채팅에 말할 수 없다', () => {
    expect(canSendHere(view('NIGHT'), 'GHOST')).toBe(false);
  });
});

describe('ChatPanel', () => {
  it('쓸 수 있는 채널만 탭으로 보여준다', () => {
    render(
      <ChatPanel
        view={view('NIGHT', { availableChannels: ['PUBLIC', 'MAFIA'] })}
        messages={[]}
        onSend={vi.fn()}
      />,
    );
    expect(screen.getByRole('tab', { name: '전체' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '마피아' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: '유령' })).not.toBeInTheDocument();
  });

  it('선택한 채널의 메시지만 보여준다', () => {
    render(<ChatPanel view={view('DAY_DISCUSSION')} messages={messages} onSend={vi.fn()} />);
    expect(screen.getByText('안녕')).toBeInTheDocument();
    expect(screen.queryByText('3번 치자')).not.toBeInTheDocument();
  });

  it('탭을 바꾸면 그 채널 메시지가 보인다', async () => {
    const mafiaView = view('NIGHT', { availableChannels: ['PUBLIC', 'MAFIA'] });
    render(<ChatPanel view={mafiaView} messages={messages} onSend={vi.fn()} />);
    await userEvent.click(screen.getByRole('tab', { name: '마피아' }));
    expect(screen.getByText('3번 치자')).toBeInTheDocument();
  });

  it('말할 수 없는 때는 입력창이 잠긴다', () => {
    render(<ChatPanel view={view('NIGHT')} messages={[]} onSend={vi.fn()} />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('보내면 채널과 함께 전달된다', async () => {
    const onSend = vi.fn();
    render(<ChatPanel view={view('DAY_DISCUSSION')} messages={[]} onSend={onSend} />);
    await userEvent.type(screen.getByRole('textbox'), '3번 수상해{Enter}');
    expect(onSend).toHaveBeenCalledWith('PUBLIC', '3번 수상해');
  });

  it('보낸 뒤 입력창이 비워진다', async () => {
    render(<ChatPanel view={view('DAY_DISCUSSION')} messages={[]} onSend={vi.fn()} />);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, '안녕{Enter}');
    expect(input).toHaveValue('');
  });

  it('보낸 사람 이름을 함께 보여준다', () => {
    render(<ChatPanel view={view('DAY_DISCUSSION')} messages={messages} onSend={vi.fn()} />);
    expect(screen.getByText('가')).toBeInTheDocument();
  });

  it('메시지가 없으면 빈 화면을 안내한다', () => {
    render(<ChatPanel view={view('DAY_DISCUSSION')} messages={[]} onSend={vi.fn()} />);
    expect(screen.getByText(/아직 오간 말이 없습니다/)).toBeInTheDocument();
  });

  it('위의 대화를 읽는 중에는 새 메시지가 와도 아래로 끌어내리지 않는다', () => {
    const initial = messages.filter((message) => message.channel === 'PUBLIC');
    const props = { view: view('DAY_DISCUSSION'), onSend: vi.fn() };
    const { rerender } = render(<ChatPanel {...props} messages={initial} />);
    const log = screen.getByRole('list');

    let scrollHeight = 300;
    Object.defineProperty(log, 'scrollHeight', { configurable: true, get: () => scrollHeight });
    Object.defineProperty(log, 'clientHeight', { configurable: true, value: 100 });
    log.scrollTop = 40;
    fireEvent.scroll(log);

    scrollHeight = 400;
    rerender(<ChatPanel {...props} messages={[
      ...initial,
      { channel: 'PUBLIC', senderId: 'p2', senderName: '나', text: '새 말', at: 10 },
    ]} />);

    expect(log.scrollTop).toBe(40);
  });
});

describe('ChatPanel — 가독성', () => {
  it('보낸 사람 옆에 자리 번호를 붙인다 — 사람들은 번호로 부른다', () => {
    const msgs = [{ channel: 'PUBLIC', senderId: 'p2', senderName: '나', text: '안녕', at: 1 }];
    render(<ChatPanel view={view('DAY_DISCUSSION')} messages={msgs} onSend={vi.fn()} />);
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('나')).toBeInTheDocument();
  });

  it('같은 사람이 연달아 말하면 이름을 한 번만 보여준다', () => {
    const msgs = [
      { channel: 'PUBLIC', senderId: 'p2', senderName: '나', text: '첫째', at: 1 },
      { channel: 'PUBLIC', senderId: 'p2', senderName: '나', text: '둘째', at: 2 },
      { channel: 'PUBLIC', senderId: 'p3', senderName: '다', text: '셋째', at: 3 },
    ];
    render(<ChatPanel view={view('DAY_DISCUSSION')} messages={msgs} onSend={vi.fn()} />);
    expect(screen.getAllByText('나')).toHaveLength(1);
    expect(screen.getByText('첫째')).toBeInTheDocument();
    expect(screen.getByText('둘째')).toBeInTheDocument();
    expect(screen.getByText('다')).toBeInTheDocument();
  });

  it('사이에 다른 사람이 끼면 이름을 다시 보여준다', () => {
    const msgs = [
      { channel: 'PUBLIC', senderId: 'p2', senderName: '나', text: '하나', at: 1 },
      { channel: 'PUBLIC', senderId: 'p3', senderName: '다', text: '둘', at: 2 },
      { channel: 'PUBLIC', senderId: 'p2', senderName: '나', text: '셋', at: 3 },
    ];
    render(<ChatPanel view={view('DAY_DISCUSSION')} messages={msgs} onSend={vi.fn()} />);
    expect(screen.getAllByText('나')).toHaveLength(2);
  });

  it('내 말은 따로 표시한다', () => {
    const msgs = [{ channel: 'PUBLIC', senderId: 'p1', senderName: '가', text: '내말', at: 1 }];
    render(<ChatPanel view={view('DAY_DISCUSSION')} messages={msgs} onSend={vi.fn()} />);
    expect(screen.getByText('내말').closest('li')).toHaveClass('chat__group--mine');
  });
});

describe('ChatPanel — 시스템 알림', () => {
  const systemMessage = {
    channel: 'PUBLIC', system: true, senderId: null, senderName: null,
    text: '나님이 처형되었습니다. 시민이었습니다.', at: 5,
  };

  it('시스템 알림을 보여준다', () => {
    render(<ChatPanel view={view('DAY_DISCUSSION')} messages={[systemMessage]} onSend={vi.fn()} />);
    expect(screen.getByText(/처형되었습니다. 시민이었습니다/)).toBeInTheDocument();
  });

  it('시스템 알림에는 보낸 사람이 없다', () => {
    render(<ChatPanel view={view('DAY_DISCUSSION')} messages={[systemMessage]} onSend={vi.fn()} />);
    const line = screen.getByText(/처형되었습니다/).closest('li');
    expect(line).toHaveClass('chat__system');
    expect(line.querySelector('.chat__who')).toBeNull();
  });

  it('사람 말과 섞여도 순서가 유지된다', () => {
    const msgs = [
      { channel: 'PUBLIC', senderId: 'p2', senderName: '나', text: '앞말', at: 1 },
      systemMessage,
      { channel: 'PUBLIC', senderId: 'p3', senderName: '다', text: '뒷말', at: 9 },
    ];
    render(<ChatPanel view={view('DAY_DISCUSSION')} messages={msgs} onSend={vi.fn()} />);
    const texts = [...screen.getByRole('list').querySelectorAll('li')].map((li) => li.textContent);
    expect(texts[0]).toContain('앞말');
    expect(texts[1]).toContain('처형되었습니다');
    expect(texts[2]).toContain('뒷말');
  });
});
