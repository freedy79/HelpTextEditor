import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Request, Response, NextFunction } from 'express';
import type { Express } from 'express';
import { fileFilter, handleUpload } from './uploadRoutes';

test('fileFilter allows whitelisted mime types and rejects others', () => {
  const allowedTypes = ['image/png', 'image/jpeg', 'application/pdf'];

  for (const type of allowedTypes) {
    let allowed: boolean | null = null;
    fileFilter(
      {} as Request,
      { mimetype: type } as Express.Multer.File,
      (_err: Error | null, accept?: boolean) => {
        allowed = accept ?? null;
      }
    );
    assert.equal(allowed, true);
  }

  let rejected: boolean | null = null;
  fileFilter(
    {} as Request,
    { mimetype: 'text/plain' } as Express.Multer.File,
    (_err: Error | null, accept?: boolean) => {
      rejected = accept ?? null;
    }
  );
  assert.equal(rejected, false);
});

test('handleUpload responds with 400 when no file is provided', () => {
  let statusCode: number | undefined;
  let payload: unknown;

  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(body: unknown) {
      payload = body;
      return this;
    },
  } as unknown as Response;

  handleUpload({} as Request, res, (() => undefined) as NextFunction);

  assert.equal(statusCode, 400);
  assert.deepEqual(payload, { error: 'No file received' });
});

test('handleUpload returns upload metadata when a file is present', () => {
  let statusCode: number | undefined;
  let payload: unknown;

  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(body: unknown) {
      payload = body;
      return this;
    },
  } as unknown as Response;

  const file = {
    filename: 'test-file.txt',
    size: 1234,
    mimetype: 'text/plain',
  };

  handleUpload({ file } as unknown as Request, res, (() => undefined) as NextFunction);

  assert.equal(statusCode, 201);
  assert.deepEqual(payload, {
    filename: 'test-file.txt',
    size: 1234,
    mimetype: 'text/plain',
    url: '/uploads/test-file.txt',
  });
});
