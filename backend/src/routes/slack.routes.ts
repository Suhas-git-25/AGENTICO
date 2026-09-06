import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { env } from '../config/env';
import { prisma } from '../db/client';
import { requireUser } from '../middleware/requireUser';

const router = Router();

/**
 * Generates an HMAC-signed state token containing the userId
 */
function generateSignedState(userId: string): string {
  const signature = crypto.createHmac('sha256', env.SESSION_SECRET).update(userId).digest('hex');
  return Buffer.from(JSON.stringify({ userId, signature })).toString('base64url');
}

/**
 * Verifies the HMAC-signed state token and extracts the userId
 */
function verifySignedState(stateStr: string): string | null {
  try {
    const raw = Buffer.from(stateStr, 'base64url').toString('utf8');
    const { userId, signature } = JSON.parse(raw);
    const expectedSignature = crypto.createHmac('sha256', env.SESSION_SECRET).update(userId).digest('hex');

    if (signature !== expectedSignature) {
      return null;
    }
    return userId;
  } catch {
    return null;
  }
}

// GET /api/slack/connect - Initiates Slack OAuth 2.0 flow
router.get('/connect', requireUser, (req: Request, res: Response) => {
  const userId = (req.user as any).id;
  const state = generateSignedState(userId);

  // If mock client id or development bypass requested
  if (!env.SLACK_CLIENT_ID || env.SLACK_CLIENT_ID.startsWith('mock-')) {
    return res.redirect(
      `${env.FRONTEND_URL}/dashboard?slack_error=${encodeURIComponent('Slack Client ID not configured in .env')}`
    );
  }

  const slackAuthUrl = new URL('https://slack.com/oauth/v2/authorize');
  slackAuthUrl.searchParams.set('client_id', env.SLACK_CLIENT_ID);
  slackAuthUrl.searchParams.set('scope', 'incoming-webhook,chat:write');
  slackAuthUrl.searchParams.set('redirect_uri', env.SLACK_REDIRECT_URI);
  slackAuthUrl.searchParams.set('state', state);

  res.redirect(slackAuthUrl.toString());
});

// GET /api/slack/callback - Exchanges OAuth code for webhook URL & team name
router.get('/callback', async (req: Request, res: Response) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect(
      `${env.FRONTEND_URL}/dashboard?slack_error=${encodeURIComponent(String(error))}`
    );
  }

  if (!code || !state) {
    return res.redirect(
      `${env.FRONTEND_URL}/dashboard?slack_error=${encodeURIComponent('Missing code or state parameter')}`
    );
  }

  const userId = verifySignedState(String(state));
  if (!userId) {
    return res.redirect(
      `${env.FRONTEND_URL}/dashboard?slack_error=${encodeURIComponent('Invalid or tampered state token')}`
    );
  }

  try {
    const tokenRes = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.SLACK_CLIENT_ID,
        client_secret: env.SLACK_CLIENT_SECRET,
        code: String(code),
        redirect_uri: env.SLACK_REDIRECT_URI,
      }),
    });

    const data = await tokenRes.json();

    if (!data.ok) {
      console.error('❌ Slack OAuth Token Exchange failed:', data);
      return res.redirect(
        `${env.FRONTEND_URL}/dashboard?slack_error=${encodeURIComponent(data.error || 'OAuth token exchange failed')}`
      );
    }

    const webhookUrl = data.incoming_webhook?.url || '';
    const teamName = data.team?.name || 'Slack Workspace';
    const accessToken = data.access_token || '';

    // Persist Slack integration for the verified user
    await prisma.slackIntegration.upsert({
      where: { userId },
      update: {
        webhookUrl,
        teamName,
        accessToken,
      },
      create: {
        userId,
        webhookUrl,
        teamName,
        accessToken,
      },
    });

    console.log(`✅ [SlackOAuth] Connected workspace '${teamName}' for user ID '${userId}'`);
    res.redirect(`${env.FRONTEND_URL}/dashboard?slack_connected=1&team=${encodeURIComponent(teamName)}`);
  } catch (err: any) {
    console.error('❌ Slack OAuth callback exception:', err.message);
    res.redirect(`${env.FRONTEND_URL}/dashboard?slack_error=${encodeURIComponent('Internal server error during Slack OAuth')}`);
  }
});

// GET /api/slack/status - Checks connection status for the logged-in user
router.get('/status', requireUser, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const integration = await prisma.slackIntegration.findUnique({
      where: { userId },
      select: {
        id: true,
        teamName: true,
        createdAt: true,
      },
    });

    res.status(200).json({
      success: true,
      connected: !!integration,
      integration: integration || null,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/slack/disconnect - Disconnects Slack workspace
router.delete('/disconnect', requireUser, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    await prisma.slackIntegration.deleteMany({
      where: { userId },
    });

    console.log(`🔌 [SlackOAuth] Disconnected Slack for user '${userId}'`);
    res.status(200).json({
      success: true,
      message: 'Slack disconnected successfully',
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Local integration testing helper only; excluded in production (real Slack OAuth uses /connect and /callback)
if (env.NODE_ENV !== 'production') {
  router.post('/mock-connect', requireUser, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any).id;
      const { webhookUrl, teamName } = req.body;

      if (!webhookUrl) {
        return res.status(400).json({ success: false, message: 'webhookUrl is required' });
      }

      const integration = await prisma.slackIntegration.upsert({
        where: { userId },
        update: {
          webhookUrl,
          teamName: teamName || 'Mock Slack Workspace',
          accessToken: 'mock-access-token',
        },
        create: {
          userId,
          webhookUrl,
          teamName: teamName || 'Mock Slack Workspace',
          accessToken: 'mock-access-token',
        },
      });

      res.status(200).json({
        success: true,
        message: 'Slack integration saved',
        data: integration,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });
}

export default router;
