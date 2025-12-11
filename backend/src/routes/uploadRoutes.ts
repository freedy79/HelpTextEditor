import { Router, Request, Response } from 'express';
import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import fs from 'fs';
import { RequestHandler } from 'express';


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
  const allowed = ['image/png', 'image/jpeg', 'application/pdf'];
  cb(null, allowed.includes(file.mimetype));
};

const upload = multer({ storage, fileFilter });

const handleUpload: RequestHandler = (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file received' });
    return;
  }

  const { filename, size, mimetype } = req.file;
  res.status(201).json({
    filename,
    size,
    mimetype,
    url: `/uploads/${filename}`,
  });
};

router.post('/upload', upload.single('file'), handleUpload);

export default router;
