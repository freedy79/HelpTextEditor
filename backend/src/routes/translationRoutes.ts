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

    const deeplResponse = await fetch('https://api-free.deepl.com/v2/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });

    if (!deeplResponse.ok) {
      const errorText = await deeplResponse.text();
      res.status(deeplResponse.status || 502).json({
        message: 'DeepL request failed.',
        details: errorText
      });
      return;
    }

    const data = await deeplResponse.json();
    res.json(data);
  } catch (error) {
    console.error('DeepL proxy error', error);
    res.status(500).json({ message: 'DeepL proxy failed. Please try again later.' });
  }
});

export default router;
