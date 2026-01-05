import assert from 'node:assert/strict';
import { after, afterEach, before, describe, it } from 'node:test';
import express, { RequestHandler } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { fileFilter, handleUpload, storage, UPLOAD_DIR } from './uploadRoutes';

const createApp = (handler: RequestHandler) => {
  const app = express();
  app.post('/upload', handler, handleUpload);
  return app;
};

describe('fileFilter', () => {
  const allowedTypes = ['image/png', 'image/jpeg', 'application/pdf'];

  for (const mimeType of allowedTypes) {
    it(`allows ${mimeType} files`, () => {
      const cb = (error: Error | null, accepted?: boolean) => {
        assert.equal(error, null);
        assert.equal(accepted, true);
      };

      fileFilter({} as any, { mimetype: mimeType } as Express.Multer.File, cb);
    });
  }

  it('rejects disallowed mime types', () => {
    const cb = (error: Error | null, accepted?: boolean) => {
      assert.equal(error, null);
      assert.equal(accepted, false);
    };

    fileFilter({} as any, { mimetype: 'text/plain' } as Express.Multer.File, cb);
  });
});

describe('handleUpload route', () => {
  const upload = multer({ storage, fileFilter }).single('file');
  let server: http.Server;
  let baseUrl: string;

  before(() => {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    const app = createApp((_req, _res, next) => upload(_req, _res, next));
    server = app.listen(0);
    const address = server.address();
    if (typeof address === 'object' && address) {
      baseUrl = `http://127.0.0.1:${address.port}`;
    } else {
      throw new Error('Unable to determine server port');
    }
  });

  after(() => {
    server.close();
  });

  afterEach(() => {
    if (!fs.existsSync(UPLOAD_DIR)) {
      return;
    }

    for (const file of fs.readdirSync(UPLOAD_DIR)) {
      fs.unlinkSync(path.join(UPLOAD_DIR, file));
    }
  });

  it('returns 400 when no file is provided', async () => {
    const response = await fetch(`${baseUrl}/upload`, { method: 'POST' });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: 'No file received' });
  });

  it('returns file metadata when upload succeeds', async () => {
    const fileBuffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG header
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
      0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
      0x54, 0x78, 0x01, 0x63, 0x60, 0x00, 0x00, 0x00,
      0x02, 0x00, 0x01, 0xe2, 0x21, 0xbc, 0x33, 0x00,
      0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
      0x42, 0x60, 0x82,
    ]);
    const formData = new FormData();
    formData.append('file', new Blob([fileBuffer], { type: 'image/png' }), 'sample.png');

    const response = await fetch(`${baseUrl}/upload`, {
      method: 'POST',
      body: formData,
    });

    assert.equal(response.status, 201);
    const body = await response.json();

    assert.match(body.filename, /\.png$/);
    assert.equal(body.mimetype, 'image/png');
    assert.equal(typeof body.size, 'number');
    assert.match(body.url, /^\/uploads\//);

    const savedFile = path.join(UPLOAD_DIR, body.filename);
    assert.equal(fs.existsSync(savedFile), true);
    assert.equal(path.dirname(savedFile), UPLOAD_DIR);
    assert.match(path.basename(savedFile), /^sample-\d+-\d+\.png$/);
  });
});
