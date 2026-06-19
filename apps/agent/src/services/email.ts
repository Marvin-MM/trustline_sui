/**
 * Email service with Resend (primary) and Nodemailer/Gmail (fallback).
 * Transparent provider switching. Writes to Notification table before sending.
 */

import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { env } from '../config/env';
import { prisma } from '../db/client';
import { logger } from '../lib/logger';
import { tracer, SpanStatusCode } from '../tracing';
import type { EmailProvider, NotificationType } from '@prisma/client';

const emailLogger = logger.child({ module: 'email' });

export class EmailService {
  private resend: Resend | null = null;
  private transporter: Transporter | null = null;

  constructor() {
    if (env.RESEND_API_KEY) {
      this.resend = new Resend(env.RESEND_API_KEY);
      emailLogger.info('Email provider: Resend');
    }

    if (env.GMAIL_USER && env.GMAIL_APP_PASSWORD) {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: env.GMAIL_USER, pass: env.GMAIL_APP_PASSWORD },
      });
      emailLogger.info('Email fallback: Gmail SMTP');
    }

    if (!this.resend && !this.transporter) {
      emailLogger.warn('No email provider configured — notifications will be recorded but not sent');
    }
  }

  async sendEmail(params: {
    to: string;
    subject: string;
    html: string;
    recipientWallet: string;
    notificationType: NotificationType;
    notificationId?: string;
    tenantId?: string | null;
    relationshipId?: string | null;
  }): Promise<void> {
    const span = tracer.startSpan('email.send', {
      attributes: { 'bondflow.email.to': params.to, 'bondflow.email.type': params.notificationType },
    });

    let provider: EmailProvider = 'RESEND';
    let sent = false;
    let error: string | null = null;

    try {
      const notification = params.notificationId
        ? await prisma.notification.findUniqueOrThrow({ where: { id: params.notificationId } })
        : await prisma.notification.create({
            data: {
              recipientEmail: params.to,
              recipientWallet: params.recipientWallet,
              tenantId: params.tenantId ?? null,
              relationshipId: params.relationshipId ?? null,
              notificationType: params.notificationType,
              subject: params.subject,
              bodyHtml: params.html,
              provider,
              sent: false,
            },
          });

      // Try Resend first
      if (this.resend) {
        try {
          await this.resend.emails.send({
            from: env.RESEND_FROM_EMAIL,
            to: params.to,
            subject: params.subject,
            html: params.html,
          });
          sent = true;
          provider = 'RESEND';
          emailLogger.info({ to: params.to, type: params.notificationType }, 'Email sent via Resend');
        } catch (resendError) {
          emailLogger.warn({ error: (resendError as Error).message }, 'Resend failed, trying fallback');
        }
      }

      // Fallback to Nodemailer
      if (!sent && this.transporter) {
        try {
          await this.transporter.sendMail({
            from: env.GMAIL_FROM_EMAIL || env.GMAIL_USER,
            to: params.to,
            subject: params.subject,
            html: params.html,
          });
          sent = true;
          provider = 'NODEMAILER';
          emailLogger.info({ to: params.to, type: params.notificationType }, 'Email sent via Nodemailer');
        } catch (nmError) {
          error = (nmError as Error).message;
          emailLogger.error({ error }, 'Both email providers failed');
        }
      }

      if (!sent && !error) {
        error = 'No email provider configured';
      }

      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          provider,
          sent,
          sentAt: sent ? new Date() : null,
          error,
        },
      });

      span.setStatus({ code: sent ? SpanStatusCode.OK : SpanStatusCode.ERROR });
      if (!sent) throw new Error(error ?? 'Email was not sent');
    } catch (e) {
      span.recordException(e as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      emailLogger.error({ error: (e as Error).message }, 'Email send failed critically');
      throw e;
    } finally {
      span.end();
    }
  }
}

export const emailService = new EmailService();
