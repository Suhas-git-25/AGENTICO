import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export const errorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Always log full stack trace / error details on server side
  console.error('❌ Server Error:', err?.stack || err);

  if (err instanceof ZodError) {
    const fieldErrors: Record<string, string[]> = {};
    const formattedErrors = err.errors.map((e) => {
      const field = e.path.join('.') || 'body';
      if (!fieldErrors[field]) {
        fieldErrors[field] = [];
      }
      fieldErrors[field].push(e.message);
      return {
        field,
        message: e.message,
      };
    });

    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: formattedErrors,
      fieldErrors,
    });
    return;
  }

  const statusCode = typeof err?.statusCode === 'number' ? err.statusCode : 500;
  // For 500 unexpected errors, return a clean generic message while preserving logs on server
  const message = statusCode === 500 ? 'Internal server error' : (err?.message || 'An unexpected error occurred');

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && statusCode !== 500 && { details: err?.message }),
  });
};
