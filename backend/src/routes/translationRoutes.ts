import https from 'node:https';
import express, { Request, Response } from 'express';
import { ApiError } from '../middlewares/errorHandler';

const router = express.Router();

type DeeplRequestBody = {
  text: string;
  sourceLang?: string;
  targetLang: string;
  authKey: string;
};

const validateDeeplRequestBody = (body: unknown): DeeplRequestBody => {
  const payload = (body ?? {}) as Record<string, unknown>;
  const missingFields: string[] = [];
  const invalidFields: string[] = [];

  const textValue = typeof payload.text === 'string' ? payload.text.trim() : '';
  const targetLangValue =
    typeof payload.targetLang === 'string' ? payload.targetLang.trim() : '';
  const authKeyValue = typeof payload.authKey === 'string' ? payload.authKey.trim() : '';
  const sourceLangValue =
    typeof payload.sourceLang === 'string' ? payload.sourceLang.trim() : undefined;

  if (textValue.length === 0) {
    missingFields.push('text');
  }

  if (targetLangValue.length === 0) {
    missingFields.push('targetLang');
  }

  if (authKeyValue.length === 0) {
    missingFields.push('authKey');
  }

  if (payload.sourceLang !== undefined && !sourceLangValue) {
    invalidFields.push('sourceLang');
  }

  if (missingFields.length > 0 || invalidFields.length > 0) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid request body.', {
      missingFields,
      invalidFields,
    });
  }

  return {
    text: textValue,
    sourceLang: sourceLangValue,
    targetLang: targetLangValue,
    authKey: authKeyValue,
  };
};

router.post('/translate/deepl', async (req: Request, res: Response): Promise<void> => {
  const { text, sourceLang, targetLang, authKey } = validateDeeplRequestBody(req.body);

  console.log('[DeepL] Incoming request', {
    hasText: !!text,
    sourceLang,
    targetLang,
    authKeyPreview: authKey ? `${authKey.slice(0, 4)}...${authKey.slice(-3)}` : 'none'
  });

  try {
    const params = new URLSearchParams();
    params.append('auth_key', authKey);
    params.append('text', text);
    params.append('target_lang', targetLang);

    if (sourceLang) {
      params.append('source_lang', sourceLang);
    }

    const deeplResponse = await sendDeepLRequest(params.toString());

    console.log('[DeepL] Response status', deeplResponse.status);

    if (!deeplResponse.ok) {
      const errorText = deeplResponse.body;
      console.error('[DeepL] Request failed', { status: deeplResponse.status, body: errorText });
      res.status(deeplResponse.status || 502).json({
        errorCode: 'DEEPL_REQUEST_FAILED',
        message: 'DeepL request failed.',
        details: deeplResponse.body
      });
      return;
    }

    let data;
    try {
      data = JSON.parse(deeplResponse.body);
      console.log('[DeepL] Request successful', {
        translationCount: Array.isArray(data?.translations) ? data.translations.length : 0
      });
    } catch (parseError) {
      console.error('DeepL response parse error', parseError);
      res.status(502).json({
        errorCode: 'DEEPL_RESPONSE_INVALID',
        message: 'Invalid response from DeepL.'
      });
      return;
    }

    res.json(data);
  } catch (error) {
    console.error('DeepL proxy error', error);
    res.status(500).json({
      errorCode: 'DEEPL_PROXY_FAILED',
      message: 'DeepL proxy failed. Please try again later.'
    });
  }
});

async function sendDeepLRequest(body: string): Promise<{ status: number; body: string; ok: boolean }> {
  return new Promise((resolve, reject) => {
    const request = https.request(
      'https://api-free.deepl.com/v2/translate',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body)
        }
      },
      response => {
        let responseBody = '';

        response.setEncoding('utf8');
        response.on('data', chunk => {
          responseBody += chunk;
        });
        response.on('end', () => {
          const status = response.statusCode ?? 0;
          resolve({ status, body: responseBody, ok: status >= 200 && status < 300 });
        });
      }
    );

    request.on('error', reject);
    request.write(body);
    request.end();
  });
}

export default router;
