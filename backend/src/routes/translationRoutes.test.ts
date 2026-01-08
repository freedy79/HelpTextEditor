import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import express from 'express';
import translationRoutes from './translationRoutes';
import errorHandler from '../middlewares/errorHandler';

describe('translationRoutes', () => {
  it('returns validation errors when required fields are missing', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api', translationRoutes);
    app.use(errorHandler);

    const server = app.listen(0);
    const address = server.address();
    if (!address || typeof address !== 'object') {
      throw new Error('Server did not start correctly');
    }

    const response = await fetch(`http://127.0.0.1:${address.port}/api/translate/deepl`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    assert.equal(response.status, 400);
    const payload = await response.json();
    assert.equal(payload.errorCode, 'VALIDATION_ERROR');
    assert.equal(payload.message, 'Invalid request body.');
    assert.ok(payload.details);

    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
});
