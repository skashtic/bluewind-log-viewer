import http from 'http';
import app from '../app';

async function listen(appInstance: typeof app): Promise<{ server: http.Server; port: number }> {
  const server = http.createServer(appInstance);
  await new Promise<void>((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => resolve());
    server.on('error', reject);
  });
  const addr = server.address();
  if (addr == null || typeof addr === 'string') {
    throw new Error('expected TCP listen address');
  }
  return { server, port: addr.port };
}

describe('HTTP routes', () => {
  it('POST /api/logs/reset responds 200', async () => {
    const { server, port } = await listen(app);
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/logs/reset`, { method: 'POST' });
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({ status: 'reset' });
    } finally {
      await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    }
  });
});
