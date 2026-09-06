import { Router, Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { env } from '../config/env';

const router = Router();

// GET /api/auth/google - Initiate Google OAuth flow
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'select_account',
  })
);

// GET /api/auth/google/callback - Google OAuth callback handler
router.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: `${env.FRONTEND_URL}/login?error=1`,
  }),
  (_req: Request, res: Response) => {
    res.redirect(`${env.FRONTEND_URL}/dashboard`);
  }
);

// GET /api/auth/me - Polled by frontend on load to verify active session
router.get('/me', (req: Request, res: Response) => {
  if (!req.isAuthenticated || !req.isAuthenticated() || !req.user) {
    res.status(401).json({
      success: false,
      message: 'Not authenticated',
      data: null,
    });
    return;
  }

  const user = req.user as any;
  res.status(200).json({
    success: true,
    data: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
    },
  });
});

// POST /api/auth/logout - Destroys the session and clears cookies
router.post('/logout', (req: Request, res: Response, next: NextFunction) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    if (req.session) {
      req.session.destroy((sessionErr) => {
        if (sessionErr) {
          return next(sessionErr);
        }
        res.clearCookie('connect.sid');
        res.status(200).json({
          success: true,
          message: 'Logged out successfully',
        });
      });
    } else {
      res.clearCookie('connect.sid');
      res.status(200).json({
        success: true,
        message: 'Logged out successfully',
      });
    }
  });
});

export default router;
