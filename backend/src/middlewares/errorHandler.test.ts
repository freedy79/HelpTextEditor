import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import express from 'express';
import http from 'http';
import errorHandler from './errorHandler';

describe('errorHandler middleware', () => {
  it('returns 500 and a generic message when an error is thrown', async () => {
    const app = express();
    app.get('/boom', () => {
      throw new Error('Unexpected');
    });
    app.use(errorHandler);

    const server = app.listen(0);
    const address = server.address();
    if (!address || typeof address !== 'object') {
      throw new Error('Server did not start correctly');
    }

    const url = `http://127.0.0.1:${address.port}/boom`;
    const response = await fetch(url);
    assert.equal(response.status, 500);
    assert.equal(await response.text(), 'Something broke!');

    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
});
