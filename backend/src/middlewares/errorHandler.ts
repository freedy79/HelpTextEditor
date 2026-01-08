import { Request, Response, NextFunction } from 'express';
import { MulterError } from 'multer';
import { config } from '../config';

type ErrorDetails = Record<string, unknown> | string | string[] | null;

export class ApiError extends Error {
  statusCode: number;
  errorCode: string;
  details?: ErrorDetails;

  constructor(statusCode: number, errorCode: string, message: string, details?: ErrorDetails) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
  }
}

const errorHandler = (err: Error, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  let statusCode = 500;
  let errorCode = 'INTERNAL_SERVER_ERROR';
  let message = 'Something went wrong.';
  let details: ErrorDetails | undefined;

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    errorCode = err.errorCode;
    message = err.message;
    details = err.details;
  } else if (err instanceof MulterError) {
    statusCode = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    errorCode = err.code === 'LIMIT_FILE_SIZE' ? 'UPLOAD_TOO_LARGE' : 'UPLOAD_FAILED';
    message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'Uploaded file exceeds size limit.'
        : 'Upload failed due to invalid input.';
    details = err.code === 'LIMIT_FILE_SIZE' ? { maxFileSizeBytes: config.upload.maxFileSizeBytes } : err.message;
  }

  console.error(err);
  res.status(statusCode).json({
    errorCode,
    message,
    details,
  });
};

export default errorHandler;
