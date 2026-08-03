import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startPhaseTimer, clearPhaseTimer } from '../src/timers.js';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function fakeRoom(phaseEndsAt) {
  return { phaseEndsAt, timer: null };
}

describe('startPhaseTimer', () => {
  it('종료 시각이 되면 콜백을 부른다', () => {
    const room = fakeRoom(10_000);
    const onExpire = vi.fn();
    startPhaseTimer(room, onExpire, { now: 0 });

    vi.advanceTimersByTime(9_999);
    expect(onExpire).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onExpire).toHaveBeenCalledWith(room);
  });

  it('이미 지난 시각이면 즉시 부른다', () => {
    const room = fakeRoom(1_000);
    const onExpire = vi.fn();
    startPhaseTimer(room, onExpire, { now: 5_000 });
    vi.advanceTimersByTime(0);
    expect(onExpire).toHaveBeenCalledOnce();
  });

  it('종료 시각이 없으면 아무 타이머도 걸지 않는다', () => {
    const room = fakeRoom(null);
    const onExpire = vi.fn();
    startPhaseTimer(room, onExpire, { now: 0 });
    expect(room.timer).toBeNull();
    vi.advanceTimersByTime(100_000);
    expect(onExpire).not.toHaveBeenCalled();
  });

  it('다시 걸면 이전 타이머를 취소한다', () => {
    const room = fakeRoom(10_000);
    const first = vi.fn();
    const second = vi.fn();
    startPhaseTimer(room, first, { now: 0 });
    room.phaseEndsAt = 20_000;
    startPhaseTimer(room, second, { now: 0 });

    vi.advanceTimersByTime(20_000);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
  });

  it('발동 후 핸들이 비워진다', () => {
    const room = fakeRoom(1_000);
    startPhaseTimer(room, () => {}, { now: 0 });
    vi.advanceTimersByTime(1_000);
    expect(room.timer).toBeNull();
  });
});

describe('clearPhaseTimer', () => {
  it('걸린 타이머를 취소한다', () => {
    const room = fakeRoom(10_000);
    const onExpire = vi.fn();
    startPhaseTimer(room, onExpire, { now: 0 });
    clearPhaseTimer(room);
    vi.advanceTimersByTime(20_000);
    expect(onExpire).not.toHaveBeenCalled();
    expect(room.timer).toBeNull();
  });

  it('타이머가 없어도 안전하다', () => {
    const room = fakeRoom(null);
    expect(() => clearPhaseTimer(room)).not.toThrow();
  });
});
