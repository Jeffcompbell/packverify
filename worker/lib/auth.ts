import { betterAuth } from 'better-auth';

export interface AuthEnv {
  DB: D1Database;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  RESEND_API_KEY?: string;
}

export function createAuth(env: AuthEnv) {
  return betterAuth({
    database: {
      provider: 'd1',
      db: env.DB,
    },
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 6,
      sendResetPassword: async ({ user, url }) => {
        // 使用 Resend 发送邮件 (每天 100 封免费)
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${env.RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: 'PackVerify <onboarding@resend.dev>',
            to: user.email,
            subject: '重置您的 PackVerify 密码',
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>重置密码</h2>
                <p>您好，${user.name || '用户'}！</p>
                <p>点击下方按钮重置您的密码（链接 1 小时内有效）：</p>
                <a href="${url}" style="display: inline-block; padding: 12px 24px; background: #7c3aed; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">重置密码</a>
                <p style="color: #666; font-size: 14px;">如果您没有请求重置密码，请忽略此邮件。</p>
              </div>
            `,
          }),
        });
      },
    },
    socialProviders: env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET ? {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      },
    } : {},
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // 1 day
    },
    user: {
      additionalFields: {
        quota: {
          type: 'number',
          defaultValue: 10,
        },
        used: {
          type: 'number',
          defaultValue: 0,
        },
        isAdmin: {
          type: 'boolean',
          defaultValue: false,
        },
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
