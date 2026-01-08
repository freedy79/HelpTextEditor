import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Request, Response, NextFunction } from 'express';
import type { Express } from 'express';
import { fileFilter, handleUpload } from './uploadRoutes';
import { ApiError } from '../middlewares/errorHandler';

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
  let rejectionError: unknown;
  fileFilter(
    {} as Request,
    { mimetype: 'text/plain' } as Express.Multer.File,
    (err: Error | null, accept?: boolean) => {
      rejectionError = err;
      rejected = accept ?? null;
    }
  );
  assert.equal(rejected, null);
  assert.ok(rejectionError instanceof ApiError);
  const apiError = rejectionError as ApiError;
  assert.equal(apiError.errorCode, 'INVALID_MIME_TYPE');
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
  const next = (err?: Error) => {
    if (err && err instanceof ApiError) {
      statusCode = err.statusCode;
      payload = { errorCode: err.errorCode, message: err.message, details: err.details };
    }
  };

  handleUpload({} as Request, res, next as NextFunction);

  assert.equal(statusCode, 400);
  assert.deepEqual(payload, {
    errorCode: 'MISSING_FILE',
    message: 'No file received.',
    details: { field: 'file' },
  });
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
