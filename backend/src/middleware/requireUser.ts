import { Request, Response, NextFunction } from 'express';

/**
 * Middleware ensuring that the request is authenticated via Passport session cookie.
 * Returns 401 Unauthorized if no active session is found.
 */
export const requireUser = (req: Request, res: Response, next: NextFunction): void => {
  if (req.isAuthenticated && req.isAuthenticated() && req.user) {
    return next();
  }

  res.status(401).json({
    success: false,
    message: 'Authentication required. Please sign in with Google.',
  });
};
