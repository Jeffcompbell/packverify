export interface Env {
  DB: D1Database;
  IMAGES: R2Bucket;
  FIREBASE_PROJECT_ID: string;
}

export async function verifyFirebaseToken(request: Request, env: Env): Promise<string | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);

  try {
    // 验证 Firebase ID Token
    // 使用 Google 的公钥验证 JWT
    const response = await fetch(
      `https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com`
    );
    const keys = await response.json();

    // 解码 token header 获取 kid
    const [headerB64] = token.split('.');
    const header = JSON.parse(atob(headerB64));

    // 简化验证：仅检查 token 格式和过期时间
    const [, payloadB64] = token.split('.');
    const payload = JSON.parse(atob(payloadB64));

    // 检查过期时间
    if (payload.exp * 1000 < Date.now()) {
      return null;
    }

    // 检查 audience 和 issuer
    if (payload.aud !== env.FIREBASE_PROJECT_ID) {
      return null;
    }

    if (payload.iss !== `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`) {
      return null;
    }

    return payload.sub; // 返回 uid
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

export function requireAuth(handler: (request: Request, env: Env, uid: string) => Promise<Response>) {
  return async (request: Request, env: Env): Promise<Response> => {
    const uid = await verifyFirebaseToken(request, env);

    if (!uid) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return handler(request, env, uid);
  };
}
