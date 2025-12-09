import { Env } from '../middleware/auth';

export async function handleGetUser(request: Request, env: Env, uid: string): Promise<Response> {
  const user = await env.DB.prepare('SELECT * FROM users WHERE uid = ?').bind(uid).first();

  if (!user) {
    return new Response(JSON.stringify({ error: 'User not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify(user), {
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function handleCreateOrUpdateUser(request: Request, env: Env, uid: string): Promise<Response> {
  const body = await request.json() as any;

  const now = Date.now();
  const existing = await env.DB.prepare('SELECT * FROM users WHERE uid = ?').bind(uid).first();

  if (existing) {
    await env.DB.prepare(
      'UPDATE users SET email = ?, display_name = ?, photo_url = ?, last_login_at = ? WHERE uid = ?'
    ).bind(body.email, body.displayName, body.photoURL, now, uid).run();
  } else {
    await env.DB.prepare(
      'INSERT INTO users (uid, email, display_name, photo_url, quota, used, is_admin, created_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(uid, body.email, body.displayName, body.photoURL, body.quota || 50, 0, body.isAdmin ? 1 : 0, now, now).run();
  }

  const user = await env.DB.prepare('SELECT * FROM users WHERE uid = ?').bind(uid).first();

  return new Response(JSON.stringify(user), {
    headers: { 'Content-Type': 'application/json' }
  });
}
