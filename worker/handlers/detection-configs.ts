import { Env } from '../middleware/auth';

export async function handleCreateConfig(request: Request, env: Env, uid: string): Promise<Response> {
  const body = await request.json() as any;
  const now = Date.now();
  const configId = crypto.randomUUID();

  await env.DB.prepare(
    'INSERT INTO detection_configs (id, user_id, name, industry, rules, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(configId, uid, body.name, body.industry, JSON.stringify(body.rules), now, now).run();

  const config = await env.DB.prepare('SELECT * FROM detection_configs WHERE id = ?').bind(configId).first();

  return new Response(JSON.stringify(config), {
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function handleListConfigs(request: Request, env: Env, uid: string): Promise<Response> {
  const configs = await env.DB.prepare('SELECT * FROM detection_configs WHERE user_id = ? ORDER BY updated_at DESC').bind(uid).all();

  return new Response(JSON.stringify(configs.results), {
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function handleGetConfig(request: Request, env: Env, uid: string, configId: string): Promise<Response> {
  const config = await env.DB.prepare('SELECT * FROM detection_configs WHERE id = ? AND user_id = ?').bind(configId, uid).first();

  if (!config) {
    return new Response(JSON.stringify({ error: 'Config not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify(config), {
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function handleUpdateConfig(request: Request, env: Env, uid: string, configId: string): Promise<Response> {
  const body = await request.json() as any;
  const now = Date.now();

  await env.DB.prepare(
    'UPDATE detection_configs SET name = ?, industry = ?, rules = ?, updated_at = ? WHERE id = ? AND user_id = ?'
  ).bind(body.name, body.industry, JSON.stringify(body.rules), now, configId, uid).run();

  const config = await env.DB.prepare('SELECT * FROM detection_configs WHERE id = ?').bind(configId).first();

  return new Response(JSON.stringify(config), {
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function handleDeleteConfig(request: Request, env: Env, uid: string, configId: string): Promise<Response> {
  await env.DB.prepare('DELETE FROM detection_configs WHERE id = ? AND user_id = ?').bind(configId, uid).run();

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
