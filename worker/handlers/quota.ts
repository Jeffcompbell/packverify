import { Env } from '../middleware/auth';

export async function handleUseQuota(request: Request, env: Env, uid: string): Promise<Response> {
  const body = await request.json() as any;

  // 检查配额
  const user = await env.DB.prepare('SELECT * FROM users WHERE uid = ?').bind(uid).first() as any;

  if (!user) {
    return new Response(JSON.stringify({ error: 'User not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (user.used >= user.quota) {
    return new Response(JSON.stringify({ error: 'Quota exceeded' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const now = Date.now();
  const usageId = crypto.randomUUID();

  // 记录使用
  await env.DB.prepare(
    'INSERT INTO quota_usage (id, user_id, type, image_name, count, timestamp, token_usage) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(usageId, uid, body.type, body.imageName, body.count || 1, now, body.tokenUsage ? JSON.stringify(body.tokenUsage) : null).run();

  // 更新用户配额
  await env.DB.prepare(
    'UPDATE users SET used = used + ? WHERE uid = ?'
  ).bind(body.count || 1, uid).run();

  const updatedUser = await env.DB.prepare('SELECT * FROM users WHERE uid = ?').bind(uid).first();

  return new Response(JSON.stringify(updatedUser), {
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function handleGetQuotaHistory(request: Request, env: Env, uid: string): Promise<Response> {
  const history = await env.DB.prepare(
    'SELECT * FROM quota_usage WHERE user_id = ? ORDER BY timestamp DESC LIMIT 100'
  ).bind(uid).all();

  return new Response(JSON.stringify(history.results), {
    headers: { 'Content-Type': 'application/json' }
  });
}
