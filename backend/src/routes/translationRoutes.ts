import https from 'node:https';
import express, { Request, Response } from 'express';

const router = express.Router();

router.post('/translate/deepl', async (req: Request, res: Response): Promise<void> => {
  const { text, sourceLang, targetLang, authKey } = req.body || {};

  if (!text || !targetLang || !authKey) {
    res.status(400).json({ message: 'Missing required fields for DeepL translation.' });
    return;
  }

  try {
    const params = new URLSearchParams();
    params.append('auth_key', authKey);
    params.append('text', text);
    params.append('target_lang', targetLang);

    if (sourceLang) {
      params.append('source_lang', sourceLang);
    }

    const deeplResponse = await sendDeepLRequest(params.toString());

    if (deeplResponse.status < 200 || deeplResponse.status >= 300) {
      res.status(deeplResponse.status || 502).json({
        message: 'DeepL request failed.',
        details: deeplResponse.body
      });
      return;
    }

    let data;
    try {
      data = JSON.parse(deeplResponse.body);
    } catch (parseError) {
      console.error('DeepL response parse error', parseError);
      res.status(502).json({ message: 'Invalid response from DeepL.' });
      return;
    }

    res.json(data);
  } catch (error) {
    console.error('DeepL proxy error', error);
    res.status(500).json({ message: 'DeepL proxy failed. Please try again later.' });
  }
});

async function sendDeepLRequest(body: string): Promise<{ status: number; body: string }> {
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
          resolve({ status: response.statusCode ?? 0, body: responseBody });
        });
      }
    );

    request.on('error', reject);
    request.write(body);
    request.end();
  });
}

export default router;
