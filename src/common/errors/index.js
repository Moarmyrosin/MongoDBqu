export class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const notFound = (msg = 'Resource not found') => new AppError(msg, 404);
export const badRequest = (msg = 'Bad request') => new AppError(msg, 400);
export const unauthorized = (msg = 'Unauthorized') => new AppError(msg, 401);
export const forbidden = (msg = 'Forbidden') => new AppError(msg, 403);
export const conflict = (msg = 'Conflict') => new AppError(msg, 409);
