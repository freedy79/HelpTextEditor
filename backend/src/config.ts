const parseNumber = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseList = (value: string | undefined, fallback: string[]): string[] => {
  if (!value) {
    return fallback;
  }
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
};

export const config = {
  port: parseNumber(process.env.PORT, 3000),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:4200',
  upload: {
    maxFileSizeBytes: parseNumber(process.env.UPLOAD_MAX_BYTES, 10 * 1024 * 1024),
    allowedMimeTypes: parseList(process.env.UPLOAD_ALLOWED_MIME_TYPES, [
      'image/png',
      'image/jpeg',
      'application/pdf',
    ]),
  },
};
