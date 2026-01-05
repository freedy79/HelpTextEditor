import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import express from 'express';
import userRoutes from './userRoutes';

describe('userRoutes', () => {
  it('returns a users payload', async () => {
    const app = express();
    app.use('/api', userRoutes);

    const server = app.listen(0);
    const address = server.address();
    if (!address || typeof address !== 'object') {
      throw new Error('Server did not start correctly');
    }

    const response = await fetch(`http://127.0.0.1:${address.port}/api/users`);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), 'Get all users');
    assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:4200');

    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
});
