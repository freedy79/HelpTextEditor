import { Router, Request, Response } from 'express';
import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import fs from 'fs';
import { RequestHandler } from 'express';
import { config } from '../config';
import { ApiError } from '../middlewares/errorHandler';


const router = Router();

/* ---------- Multer configuration ---------- */

// Folder where incoming files will be stored
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');

// Ensure the folder exists at startup
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Custom storage: keep the original file name but prepend a timestamp
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext);
    cb(null, `${base}-${unique}${ext}`);
  },
});

// Optional: basic MIME-type whitelist
const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
) => {
  const allowed = config.upload.allowedMimeTypes;
  if (!allowed.includes(file.mimetype)) {
    cb(
      new ApiError(400, 'INVALID_MIME_TYPE', 'Unsupported file type.', {
        allowed,
        received: file.mimetype,
      })
    );
    return;
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.upload.maxFileSizeBytes,
  },
});

const validateUploadFile = (file: Express.Multer.File): Express.Multer.File => {
  const invalidFields: string[] = [];

  if (typeof file.filename !== 'string' || file.filename.trim().length === 0) {
    invalidFields.push('filename');
  }

  if (typeof file.size !== 'number' || !Number.isFinite(file.size) || file.size < 0) {
    invalidFields.push('size');
  }

  if (typeof file.mimetype !== 'string' || file.mimetype.trim().length === 0) {
    invalidFields.push('mimetype');
  }

  if (invalidFields.length > 0) {
    throw new ApiError(400, 'INVALID_UPLOAD', 'Invalid upload payload.', { invalidFields });
  }

  return file;
};

const handleUpload: RequestHandler = (req, res, next) => {
  if (!req.file) {
    next(new ApiError(400, 'MISSING_FILE', 'No file received.', { field: 'file' }));
    return;
  }

  let validatedFile: Express.Multer.File;
  try {
    validatedFile = validateUploadFile(req.file);
  } catch (error) {
    next(error as Error);
    return;
  }

  const { filename, size, mimetype } = validatedFile;
  res.status(201).json({
    filename,
    size,
    mimetype,
    url: `/uploads/${filename}`,
  });
};

router.post('/upload', upload.single('file'), handleUpload);

export { handleUpload, fileFilter, storage, UPLOAD_DIR };
export default router;
