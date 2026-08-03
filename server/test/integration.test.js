import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { io as connect } from 'socket.io-client';
import { createServer } from '../src/index.js';
import { ROLE, PHASE } from '../src/game/roles.js';
import { ACTION } from '../src/game/actions.js';

let httpServer;
let registry;
let port;
const clients = [];

beforeEach(async () => {
  const server = createServer();
  httpServer = server.httpServer;
  registry = server.registry;
  await new Promise((resolve) => httpServer.listen(0, resolve));
  port = httpServer.address().port;
});

afterEach(async () => {
  for (const c of clients.splice(0)) c.disconnect();
  await new Promise((resolve) => httpServer.close(resolve));
});

function newClient() {
  const client = connect(`http://localhost:${port}`, { transports: ['websocket'] });
  clients.push(client);
  return client;
}

/** 이벤트 하나를 기다린다. */
function once(client, event) {
  return new Promise((resolve) => client.once(event, resolve));
}

/** 조건을 만족하는 state:update가 올 때까지 기다린다. */
function until(client, predicate) {
  return new Promise((resolve) => {
    const handler = (view) => {
      if (predicate(view)) {
        client.off('state:update', handler);
        resolve(view);
      }
    };
    client.on('state:update', handler);
  });
}

function emitAck(client, event, payload) {
  return new Promise((resolve) => client.emit(event, payload, resolve));
}

/** 방장 1명 + 참가자 (count-1)명을 붙인다. */
async function seatPlayers(count) {
  const host = newClient();
  await once(host, 'connect');
  const created = await emitAck(host, 'room:create', { nickname: '사람1' });
  const code = created.code;

  const guests = [];
  for (let i = 2; i <= count; i++) {
    const guest = newClient();
    await once(guest, 'connect');
    await emitAck(guest, 'room:join', { code, nickname: `사람${i}` });
    guests.push(guest);
  }
  return { host, guests, code, all: [host, ...guests] };
}

describe('방 만들기와 입장', () => {
  it('방을 만들면 코드와 플레이어 토큰을 받는다', async () => {
    const client = newClient();
    await once(client, 'connect');
    const result = await emitAck(client, 'room:create', { nickname: '방장' });
    expect(result.ok).toBe(true);
    expect(result.code).toMatch(/^[A-Z2-9]{6}$/);
    expect(result.playerId).toBeTruthy();
  });

  it('없는 코드로 들어가면 실패한다', async () => {
    const client = newClient();
    await once(client, 'connect');
    expect(await emitAck(client, 'room:join', { code: 'ZZZZZZ', nickname: '손님' }))
      .toEqual({ ok: false, code: 'ROOM_NOT_FOUND' });
  });

  it('입장하면 모두에게 갱신된 참가자 목록이 간다', async () => {
    const { host } = await seatPlayers(3);
    const view = await until(host, (v) => v.players.length === 3);
    expect(view.players.map((p) => p.nickname)).toEqual(['사람1', '사람2', '사람3']);
  });
});

describe('게임 시작', () => {
  it('방장이 시작하면 첫 밤이 열린다', async () => {
    const { host, all } = await seatPlayers(7);
    const views = all.map((c) => until(c, (v) => v.phase === PHASE.NIGHT));
    host.emit('game:start');
    const results = await Promise.all(views);
    for (const view of results) {
      expect(view.day).toBe(1);
      expect(view.phaseEndsAt).toBeGreaterThan(Date.now());
    }
  });

  it('방장이 아니면 시작할 수 없다', async () => {
    const { guests } = await seatPlayers(7);
    const errorPromise = once(guests[0], 'error');
    guests[0].emit('game:start');
    expect(await errorPromise).toEqual({ code: 'NOT_HOST' });
    expect([...registry.rooms.values()][0].phase).toBe(PHASE.WAITING);
  });

  it('5명 미만이면 시작할 수 없다', async () => {
    const { host } = await seatPlayers(4);
    const errorPromise = once(host, 'error');
    host.emit('game:start');
    expect(await errorPromise).toEqual({ code: 'BAD_PLAYER_COUNT' });
  });
});

describe('비밀 정보', () => {
  it('각자 자기 역할만 받고 남의 역할은 받지 않는다', async () => {
    const { host, all } = await seatPlayers(7);
    const views = all.map((c) => until(c, (v) => v.phase === PHASE.NIGHT));
    host.emit('game:start');
    const results = await Promise.all(views);

    for (const view of results) {
      expect(Object.values(ROLE)).toContain(view.me.role);
      for (const p of view.players) expect(p).not.toHaveProperty('role');
    }
    // 7명 판이면 마피아 2명이 나와야 한다.
    expect(results.filter((v) => v.me.role === ROLE.MAFIA)).toHaveLength(2);
  });

  it('마피아는 서로를 알고 시민은 아무도 모른다', async () => {
    const { host, all } = await seatPlayers(7);
    const views = all.map((c) => until(c, (v) => v.phase === PHASE.NIGHT));
    host.emit('game:start');
    const results = await Promise.all(views);

    for (const view of results) {
      if (view.me.role === ROLE.MAFIA) expect(view.me.teammates).toHaveLength(1);
      else expect(view.me.teammates).toEqual([]);
    }
  });
});

describe('채팅', () => {
  it('밤의 마피아 채팅은 마피아에게만 도착한다', async () => {
    const { host, all } = await seatPlayers(7);
    const views = all.map((c) => until(c, (v) => v.phase === PHASE.NIGHT));
    host.emit('game:start');
    const results = await Promise.all(views);

    const mafiaIndex = results.findIndex((v) => v.me.role === ROLE.MAFIA);
    const otherMafiaIndex = results.findIndex((v, i) => i !== mafiaIndex && v.me.role === ROLE.MAFIA);
    const citizenIndex = results.findIndex((v) => v.me.role === ROLE.CITIZEN);

    const received = [];
    all[citizenIndex].on('chat:message', (m) => received.push(m));
    const mafiaGot = once(all[otherMafiaIndex], 'chat:message');

    all[mafiaIndex].emit('chat:send', { channel: 'MAFIA', text: '3번 어때' });
    expect((await mafiaGot).text).toBe('3번 어때');

    await new Promise((r) => setTimeout(r, 50));
    expect(received).toEqual([]);
  });

  it('밤에는 전체 채팅이 막힌다', async () => {
    const { host, all } = await seatPlayers(7);
    const views = all.map((c) => until(c, (v) => v.phase === PHASE.NIGHT));
    host.emit('game:start');
    await Promise.all(views);

    const errorPromise = once(all[0], 'error');
    all[0].emit('chat:send', { channel: 'PUBLIC', text: '아무말' });
    expect(await errorPromise).toEqual({ code: 'CHAT_BLOCKED' });
  });
});

describe('재접속', () => {
  it('끊었다 토큰으로 돌아오면 역할과 동료가 복구된다', async () => {
    const { host, all, code } = await seatPlayers(7);
    const room = [...registry.rooms.values()][0];
    const views = all.map((c) => until(c, (v) => v.phase === PHASE.NIGHT));
    host.emit('game:start');
    const results = await Promise.all(views);

    const index = results.findIndex((v) => v.me.role === ROLE.MAFIA);
    const before = results[index];
    const playerId = before.me.id;

    all[index].disconnect();
    await new Promise((r) => setTimeout(r, 50));
    expect(room.players.find((p) => p.id === playerId).connected).toBe(false);

    const revived = newClient();
    await once(revived, 'connect');
    const restored = until(revived, (v) => v.phase === PHASE.NIGHT);
    await emitAck(revived, 'room:rejoin', { code, playerId });
    const after = await restored;

    expect(after.me.role).toBe(ROLE.MAFIA);
    expect(after.me.teammates).toEqual(before.me.teammates);
  });

  it('재접속하면 자기가 받았던 채팅만 복구된다', async () => {
    const { host, all, code } = await seatPlayers(7);
    const views = all.map((c) => until(c, (v) => v.phase === PHASE.NIGHT));
    host.emit('game:start');
    const results = await Promise.all(views);

    const mafiaIndex = results.findIndex((v) => v.me.role === ROLE.MAFIA);
    const citizenIndex = results.findIndex((v) => v.me.role === ROLE.CITIZEN);
    const citizenId = results[citizenIndex].me.id;

    all[mafiaIndex].emit('chat:send', { channel: 'MAFIA', text: '비밀' });
    await new Promise((r) => setTimeout(r, 50));

    all[citizenIndex].disconnect();
    const revived = newClient();
    await once(revived, 'connect');
    const historyPromise = once(revived, 'chat:history');
    await emitAck(revived, 'room:rejoin', { code, playerId: citizenId });

    expect(await historyPromise).toEqual([]);
  });
});

describe('한 판을 끝까지 돌린다', () => {
  it('밤 살해 → 낮 → 투표 → 처형까지 진행된다', async () => {
    const { host, all } = await seatPlayers(7);
    const nightViews = all.map((c) => until(c, (v) => v.phase === PHASE.NIGHT));
    host.emit('game:start');
    const views = await Promise.all(nightViews);
    const room = [...registry.rooms.values()][0];

    // 마피아·의사·경찰·스파이가 서로 다른 대상을 골라 밤을 조기 종료시킨다.
    const byRole = (role) => views.map((v, i) => ({ v, i })).filter((x) => x.v.me.role === role);
    const citizens = byRole(ROLE.CITIZEN);
    const victimId = citizens[0].v.me.id;

    const dayReached = all.map((c) => until(c, (v) => v.phase === PHASE.DAY_DISCUSSION));
    for (const { i } of byRole(ROLE.MAFIA)) {
      all[i].emit('action:submit', { type: ACTION.MAFIA_KILL, targetId: victimId });
    }
    all[byRole(ROLE.DOCTOR)[0].i].emit('action:submit', {
      type: ACTION.DOCTOR_SAVE, targetId: citizens[1].v.me.id,
    });
    all[byRole(ROLE.POLICE)[0].i].emit('action:submit', {
      type: ACTION.POLICE_CHECK, targetId: victimId,
    });
    all[byRole(ROLE.SPY)[0].i].emit('action:submit', {
      type: ACTION.SPY_CONTACT, targetId: citizens[1].v.me.id,
    });

    const dayViews = await Promise.all(dayReached);
    expect(dayViews[0].lastNightResult).toEqual({ killedId: victimId, blocked: false });
    expect(dayViews[0].players.find((p) => p.id === victimId).revealedTeam).toBe('CITIZEN');
    expect(room.phase).toBe(PHASE.DAY_DISCUSSION);
  }, 15_000);
});
