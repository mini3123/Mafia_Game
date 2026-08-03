import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServer } from '../src/index.js';

let httpServer;
let base;

beforeEach(async () => {
  ({ httpServer } = createServer());
  await new Promise((resolve) => httpServer.listen(0, resolve));
  base = `http://localhost:${httpServer.address().port}`;
});

afterEach(async () => {
  await new Promise((resolve) => httpServer.close(resolve));
});

describe('정적 서빙', () => {
  it('헬스체크가 응답한다', async () => {
    const response = await fetch(`${base}/health`);
    expect(await response.json()).toEqual({ ok: true });
  });

  it('빌드 결과가 없어도 서버가 죽지 않는다', async () => {
    // 클라이언트를 빌드하지 않은 상태에서도 응답만 할 뿐 크래시하지 않아야 한다.
    const response = await fetch(`${base}/`);
    expect([200, 404]).toContain(response.status);
  });

  it('소켓 경로를 가로채지 않는다', async () => {
    const response = await fetch(`${base}/socket.io/?EIO=4&transport=polling`);
    expect(response.status).toBe(200);
  });
});
