import { prisma } from '../db/client';

/**
 * Sends a live Slack webhook alert when a sender hits their hourly email rate limit.
 *
 * Requirements:
 * - Looks up the SlackIntegration for the sender's owning user.
 * - If none exists, logs and returns silently (no crash, no notification).
 * - If one exists, performs an asynchronous POST to the stored webhook URL.
 */
export async function notifyRateLimitHit(
  senderId: string,
  currentCount: number,
  hourlyLimit: number
): Promise<void> {
  try {
    const sender = await prisma.sender.findUnique({
      where: { id: senderId },
      include: {
        user: {
          include: {
            slackIntegration: true,
          },
        },
      },
    });

    if (!sender) {
      console.warn(`⚠️ [SlackNotifier] Sender '${senderId}' not found.`);
      return;
    }

    const slackIntegration = sender.user?.slackIntegration;

    if (!slackIntegration || !slackIntegration.webhookUrl) {
      console.log(
        `ℹ️ [SlackNotifier] No Slack integration found for user '${sender.userId}'. Rate limit notification skipped silently.`
      );
      return;
    }

    const payload = {
      text: `⚠️ *ReachInbox Rate Limit Alert*: Sender *${sender.name}* hit its hourly limit of *${hourlyLimit}* emails.`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '⚠️ Hourly Rate Limit Exceeded',
            emoji: true,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Sender:*\n${sender.name} (${sender.smtpUser})`,
            },
            {
              type: 'mrkdwn',
              text: `*Rate Limit:*\n${hourlyLimit} emails / hour`,
            },
            {
              type: 'mrkdwn',
              text: `*Triggered Count:*\n${currentCount}`,
            },
            {
              type: 'mrkdwn',
              text: `*Status:*\nRescheduled to next hour`,
            },
          ],
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `🕒 Timestamp: ${new Date().toISOString()} | ReachInbox Distributed Job Scheduler`,
            },
          ],
        },
      ],
    };

    const response = await fetch(slackIntegration.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`⚠️ [SlackNotifier] Webhook returned status ${response.status}: ${errorText}`);
    } else {
      console.log(`📣 [SlackNotifier] Live rate limit alert delivered to Slack workspace '${slackIntegration.teamName}'`);
    }
  } catch (error: any) {
    // Non-blocking: ensure Slack network glitches never disrupt email worker execution
    console.error('❌ [SlackNotifier] Error dispatching Slack notification:', error.message);
  }
}
