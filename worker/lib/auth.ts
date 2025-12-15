import { betterAuth } from 'better-auth';

export interface AuthEnv {
  DB: D1Database;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
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
