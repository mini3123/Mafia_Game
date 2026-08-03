import { createServer as createHttpServer } from 'node:http';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
import { createRegistry, sweepEmptyRooms } from './rooms.js';
import { attachSocketServer } from './socket.js';

const SWEEP_INTERVAL_MS = 60_000;

const here = dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = resolve(here, '../../client/dist');

export function createServer({ registry = createRegistry() } = {}) {
  const app = express();
  app.get('/health', (_req, res) => res.json({ ok: true }));

  // 빌드된 클라이언트를 같은 오리진에서 서빙한다 — CORS 설정이 필요 없어진다.
  // 개발 중에는 dist가 없을 수 있으므로 있을 때만 붙인다.
  if (existsSync(CLIENT_DIST)) {
    app.use(express.static(CLIENT_DIST));
    // 새로고침해도 index.html로 떨어지게 한다. /socket.io는 건드리지 않는다.
    app.get(/^\/(?!socket\.io).*/, (_req, res) => res.sendFile(join(CLIENT_DIST, 'index.html')));
  }

  const httpServer = createHttpServer(app);
  const io = new Server(httpServer, { cors: { origin: true } });
  attachSocketServer(io, registry);

  return { app, httpServer, io, registry };
}

// 직접 실행했을 때만 포트를 연다. 테스트는 createServer만 쓴다.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  const port = Number(process.env.PORT ?? 3000);
  const { httpServer, registry } = createServer();
  setInterval(() => sweepEmptyRooms(registry, { now: Date.now() }), SWEEP_INTERVAL_MS).unref();
  httpServer.listen(port, () => console.log(`마피아 서버가 ${port} 포트에서 대기 중입니다`));
}
