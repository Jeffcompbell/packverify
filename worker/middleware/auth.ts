import { createAuth } from '../lib/auth';

export interface Env {
  DB: D1Database;
  IMAGES: R2Bucket;
  R2: R2Bucket;
  FIREBASE_PROJECT_ID: string;
  AI_API_URL: string;
  AI_API_KEY: string;
  AI_MODEL?: string;
  // Billing
  BILLING_MODE?: 'count' | 'tokens';
  TOKENS_PER_CREDIT?: string;
  // Better Auth
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
}

// 验证 Better Auth session
export async function verifyBetterAuthSession(request: Request, env: Env): Promise<string | null> {
  try {
    const auth = createAuth(env);
    const session = await auth.api.getSession({ headers: request.headers });
    return session?.user?.id || null;
  } catch (error) {
    console.error('Better Auth session verification failed:', error);
    return null;
  }
}

// 验证 Firebase Token（保留兼容）
export async function verifyFirebaseToken(request: Request, env: Env): Promise<string | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);

  try {
    const response = await fetch(
      `https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com`
    );
    const keys = await response.json();

    const [headerB64] = token.split('.');
    const header = JSON.parse(atob(headerB64));

    const [, payloadB64] = token.split('.');
    const payload = JSON.parse(atob(payloadB64));

    if (payload.exp * 1000 < Date.now()) {
      return null;
    }

    if (payload.aud !== env.FIREBASE_PROJECT_ID) {
      return null;
    }

    if (payload.iss !== `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`) {
      return null;
    }

    return payload.sub;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

// 统一验证：优先 Better Auth，回退 Firebase
export async function verifyAuth(request: Request, env: Env): Promise<string | null> {
  // 先尝试 Better Auth session
  const betterAuthUid = await verifyBetterAuthSession(request, env);
  if (betterAuthUid) return betterAuthUid;

  // 回退到 Firebase token
  return verifyFirebaseToken(request, env);
}

export function requireAuth(handler: (request: Request, env: Env, uid: string) => Promise<Response>) {
  return async (request: Request, env: Env): Promise<Response> => {
    const uid = await verifyAuth(request, env);

    if (!uid) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return handler(request, env, uid);
  };
}
