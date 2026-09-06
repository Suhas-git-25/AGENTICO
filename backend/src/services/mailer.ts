import nodemailer, { Transporter, SentMessageInfo } from 'nodemailer';
import { env } from '../config/env';

let transportInstance: Transporter | null = null;

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  smtpUser?: string;
  smtpPass?: string;
}

export interface MailSendResult extends SentMessageInfo {
  previewUrl: string | false;
}

/**
 * Creates or returns the cached Nodemailer SMTP transport for Ethereal Email.
 */
export function getTransport(smtpUser?: string, smtpPass?: string): Transporter {
  const user = smtpUser || env.ETHEREAL_USER;
  const pass = smtpPass || env.ETHEREAL_PASS;

  // If custom credentials are provided, create a specific transport
  if (smtpUser && smtpPass) {
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user,
        pass,
      },
    });
  }

  // Otherwise, use cached default transport
  if (!transportInstance) {
    transportInstance = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: env.ETHEREAL_USER,
        pass: env.ETHEREAL_PASS,
      },
    });
  }

  return transportInstance;
}

/**
 * Sends an email using Nodemailer and logs the Ethereal preview URL.
 */
export async function sendMail(options: SendMailOptions): Promise<MailSendResult> {
  const { to, subject, html, text, from, smtpUser, smtpPass } = options;
  const user = smtpUser || env.ETHEREAL_USER;
  const transport = getTransport(smtpUser, smtpPass);

  const senderAddress = from || `"ReachInbox Scheduler" <${user}>`;

  const info = await transport.sendMail({
    from: senderAddress,
    to,
    subject,
    html,
    text: text || html.replace(/<[^>]*>?/gm, ''), // fallback plain text from html
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);

  console.log(`\n================================================================`);
  console.log(`✉️ Email Dispatched Successfully!`);
  console.log(`   To:      ${to}`);
  console.log(`   Subject: ${subject}`);
  console.log(`   Message ID: ${info.messageId}`);
  if (previewUrl) {
    console.log(`   📬 Ethereal Preview URL: ${previewUrl}`);
  }
  console.log(`================================================================\n`);

  return {
    ...info,
    previewUrl,
  };
}
