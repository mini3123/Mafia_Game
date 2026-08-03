import { createServer as createHttpServer } from 'node:http';
import express from 'express';
import { Server } from 'socket.io';
import { createRegistry, sweepEmptyRooms } from './rooms.js';
import { attachSocketServer } from './socket.js';

const SWEEP_INTERVAL_MS = 60_000;

export function createServer({ registry = createRegistry() } = {}) {
  const app = express();
  app.get('/health', (_req, res) => res.json({ ok: true }));

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
